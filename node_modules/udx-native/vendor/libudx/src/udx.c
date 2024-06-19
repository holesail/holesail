#include <assert.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <uv.h>

#include "../include/udx.h"
#include "internal.h"

#include "cirbuf.h"
#include "debug.h"
#include "endian.h"
#include "fifo.h"
#include "io.h"

#define UDX_STREAM_ALL_DESTROYED (UDX_STREAM_DESTROYED | UDX_STREAM_DESTROYED_REMOTE)
#define UDX_STREAM_ALL_ENDED     (UDX_STREAM_ENDED | UDX_STREAM_ENDED_REMOTE)
#define UDX_STREAM_DEAD          (UDX_STREAM_ALL_DESTROYED | UDX_STREAM_DESTROYING | UDX_STREAM_CLOSED)

#define UDX_STREAM_SHOULD_READ (UDX_STREAM_ENDED_REMOTE | UDX_STREAM_DEAD)
#define UDX_STREAM_READ        0

#define UDX_STREAM_SHOULD_END (UDX_STREAM_ENDING | UDX_STREAM_ENDED | UDX_STREAM_DEAD)
#define UDX_STREAM_END        UDX_STREAM_ENDING

#define UDX_STREAM_SHOULD_END_REMOTE (UDX_STREAM_ENDED_REMOTE | UDX_STREAM_DEAD | UDX_STREAM_ENDING_REMOTE)
#define UDX_STREAM_END_REMOTE        UDX_STREAM_ENDING_REMOTE

#define UDX_HEADER_DATA_OR_END (UDX_HEADER_DATA | UDX_HEADER_END)

#define UDX_DEFAULT_TTL         64
#define UDX_DEFAULT_BUFFER_SIZE 212992

#define UDX_MAX_TRANSMITS 6

#define UDX_SLOW_RETRANSMIT 1
#define UDX_FAST_RETRANSMIT 2

#define UDX_CONG_C           400  // C=0.4 (inverse) in scaled 1000
#define UDX_CONG_C_SCALE     1e12 // ms/s ** 3 * c-scale
#define UDX_CONG_BETA        731  // b=0.3, BETA = 1-b, scaled 1024
#define UDX_CONG_BETA_UNIT   1024
#define UDX_CONG_BETA_SCALE  (8 * (UDX_CONG_BETA_UNIT + UDX_CONG_BETA) / 3 / (UDX_CONG_BETA_UNIT - UDX_CONG_BETA)) // 3B/(2-B) scaled 8
#define UDX_CONG_CUBE_FACTOR UDX_CONG_C_SCALE / UDX_CONG_C
#define UDX_CONG_INIT_CWND   3
#define UDX_CONG_MAX_CWND    65536

#define UDX_HIGH_WATERMARK 262144

#define UDX_MAX_COMBINED_WRITES 1000

typedef struct {
  uint32_t seq; // must be the first entry, so its compat with the cirbuf

  int type;

  uv_buf_t buf;
} udx_pending_read_t;

static inline uint32_t
cubic_root (uint64_t a) {
  return (uint32_t) cbrt(a);
}

static uint32_t
max_uint32 (uint32_t a, uint32_t b) {
  return a < b ? b : a;
}

static uint64_t
min_uint64 (uint64_t a, uint64_t b) {
  return a < b ? a : b;
}

static int32_t
seq_diff (uint32_t a, uint32_t b) {
  return a - b;
}

static int
seq_compare (uint32_t a, uint32_t b) {
  int32_t d = seq_diff(a, b);
  return d < 0 ? -1 : d > 0 ? 1
                            : 0;
}

static uint32_t
seq_max (uint32_t a, uint32_t b) {
  return seq_compare(a, b) < 0 ? b : a;
}

static inline bool
is_addr_v4_mapped (const struct sockaddr *addr) {
  return addr->sa_family == AF_INET6 && IN6_IS_ADDR_V4MAPPED(&(((struct sockaddr_in6 *) addr)->sin6_addr));
}

static inline void
addr_to_v4 (struct sockaddr_in6 *addr) {
  struct sockaddr_in in;
  memset(&in, 0, sizeof(in));

  in.sin_family = AF_INET;
  in.sin_port = addr->sin6_port;
#ifdef SIN6_LEN
  in.sin_len = sizeof(struct sockaddr_in);
#endif

  // Copy the IPv4 address from the last 4 bytes of the IPv6 address.
  memcpy(&(in.sin_addr), &(addr->sin6_addr.s6_addr[12]), 4);

  memcpy(addr, &in, sizeof(in));
}

static inline uint32_t
max_payload (udx_stream_t *stream) {
  assert(stream->mtu > (AF_INET ? UDX_IPV4_HEADER_SIZE : UDX_IPV6_HEADER_SIZE));
  return stream->mtu - (stream->remote_addr.ss_family == AF_INET ? UDX_IPV4_HEADER_SIZE : UDX_IPV6_HEADER_SIZE);
}

static inline uint32_t
cwnd_in_bytes (udx_stream_t *stream) {
  return stream->cwnd * max_payload(stream);
}

static void
on_uv_poll (uv_poll_t *handle, int status, int events);

static void
ref_inc (udx_t *udx) {
  udx->refs++;

  if (udx->streams != NULL) return;

  udx->streams_len = 0;
  udx->streams_max_len = 16;
  udx->streams = malloc(udx->streams_max_len * sizeof(udx_stream_t *));

  udx__cirbuf_init(&(udx->streams_by_id), 16);
}

static void
ref_dec (udx_t *udx) {
  udx->refs--;

  if (udx->refs || udx->streams == NULL) return;

  free(udx->streams);
  udx->streams = NULL;
  udx->streams_max_len = 0;

  udx__cirbuf_destroy(&(udx->streams_by_id));
}

static void
trigger_socket_close (udx_socket_t *socket) {
  if (--socket->pending_closes) return;

  udx__fifo_destroy(&(socket->send_queue));

  if (socket->on_close != NULL) {
    socket->on_close(socket);
  }

  ref_dec(socket->udx);
}

static void
on_uv_close (uv_handle_t *handle) {
  trigger_socket_close((udx_socket_t *) handle->data);
}

static void
on_uv_interval (uv_timer_t *handle) {
  udx_check_timeouts((udx_t *) handle->data);
}

static int
udx_start_timer (udx_t *udx) {
  uv_timer_t *timer = &(udx->timer);

  memset(timer, 0, sizeof(uv_timer_t));

  int err = uv_timer_init(udx->loop, timer);
  assert(err == 0);

  err = uv_timer_start(timer, on_uv_interval, UDX_CLOCK_GRANULARITY_MS, UDX_CLOCK_GRANULARITY_MS);
  assert(err == 0);

  timer->data = udx;

  return err;
}

static void
on_udx_timer_close (uv_handle_t *handle) {
  udx_t *udx = (udx_t *) handle->data;
  udx_socket_t *socket = udx->timer_closed_by;

  // always clear this as someone needs to reboot the timer now
  udx->timer_closed_by = NULL;

  if (udx->sockets > 0) { // re-open
    udx_start_timer(udx);
  }

  trigger_socket_close(socket);
}

void
udx__close_handles (udx_socket_t *socket) {
  if (socket->status & UDX_SOCKET_CLOSING_HANDLES) return;
  socket->status |= UDX_SOCKET_CLOSING_HANDLES;

  if (socket->status & UDX_SOCKET_BOUND) {
    socket->pending_closes++;
    uv_poll_stop(&(socket->io_poll));
    uv_close((uv_handle_t *) &(socket->io_poll), on_uv_close);
  }

  socket->pending_closes += 2; // one below and one in trigger_socket_close
  uv_close((uv_handle_t *) &(socket->handle), on_uv_close);

  udx_t *udx = socket->udx;

  udx->sockets--;

  if (udx->sockets > 0 || udx->timer_closed_by) {
    trigger_socket_close(socket);
    return;
  }

  udx->timer_closed_by = socket;

  uv_timer_stop(&(udx->timer));
  uv_close((uv_handle_t *) &(udx->timer), on_udx_timer_close);
}

static bool
stream_write_wanted (udx_stream_t *stream) {
  if (!(stream->status & UDX_STREAM_CONNECTED)) {
    return false;
  }

  if (stream->write_wanted) {
    return true;
  }

  return stream->pkts_inflight < stream->cwnd && ((stream->write_queue.len > 0) || stream->retransmit_queue.len > 0 || stream->unordered.len > 0);
}

static bool
socket_write_wanted (udx_socket_t *socket) {

  if (socket->send_queue.len > 0) {
    return true;
  }

  for (uint32_t i = 0; i < socket->udx->streams_len; i++) {
    udx_stream_t *stream = socket->udx->streams[i];
    if (stream->socket == socket && stream_write_wanted(stream)) {
      return true;
    }
  }

  return false;
}

static int
update_poll (udx_socket_t *socket) {
  int events = UV_READABLE;

  if (socket_write_wanted(socket)) {
    events |= UV_WRITABLE;
  }

  if (events == socket->events) return 0;

  socket->events = events;
  return uv_poll_start(&(socket->io_poll), events, on_uv_poll);
}

// cubic congestion as per the paper https://www.cs.princeton.edu/courses/archive/fall16/cos561/papers/Cubic08.pdf

static void
increase_cwnd (udx_stream_t *stream, uint32_t cnt, uint32_t acked) {
  // smooth out applying the window increase using the counters...

  if (stream->cwnd_cnt >= cnt) {
    stream->cwnd_cnt = 0;
    stream->cwnd++;
  }

  stream->cwnd_cnt += acked;

  if (stream->cwnd_cnt >= cnt) {
    uint32_t delta = stream->cwnd_cnt / cnt;
    stream->cwnd_cnt -= delta * cnt;
    stream->cwnd += delta;
  }

  // clamp it
  if (stream->cwnd > UDX_CONG_MAX_CWND) {
    stream->cwnd = UDX_CONG_MAX_CWND;
  }
}

static void
reduce_cwnd (udx_stream_t *stream, int reset) {
  udx_cong_t *c = &(stream->cong);

  if (reset) {
    memset(c, 0, sizeof(udx_cong_t));
  } else {
    c->start_time = 0;
    c->last_max_cwnd = stream->cwnd < c->last_max_cwnd
                         ? (stream->cwnd * (UDX_CONG_BETA_UNIT + UDX_CONG_BETA)) / (2 * UDX_CONG_BETA_UNIT)
                         : stream->cwnd;
  }

  uint32_t upd = (stream->cwnd * UDX_CONG_BETA) / UDX_CONG_BETA_UNIT;

  stream->cwnd = stream->ssthresh = upd < 2 ? 2 : upd;
  stream->cwnd_cnt = 0; // TODO: dbl check that we should reset this

  debug_print_cwnd_stats(stream);
}

static void
update_congestion (udx_cong_t *c, uint32_t cwnd, uint32_t acked, uint64_t time) {
  c->ack_cnt += acked;

  // sanity check that didn't just enter this
  if (c->last_cwnd == cwnd && (time - c->last_time) <= 3) return;

  uint64_t delta;

  // make sure we don't over run this
  if (!c->start_time || time != c->last_time) {
    c->last_cwnd = cwnd;
    c->last_time = time;

    // we just entered this, init all state
    if (c->start_time == 0) {
      c->start_time = time;
      c->ack_cnt = acked;
      c->tcp_cwnd = cwnd;

      if (c->last_max_cwnd <= cwnd) {
        c->K = 0;
        c->origin_point = cwnd;
      } else {
        c->K = cubic_root(UDX_CONG_CUBE_FACTOR * (c->last_max_cwnd - cwnd));
        c->origin_point = c->last_max_cwnd;
      }
    }

    // time since epoch + delay
    uint32_t t = time - c->start_time + c->delay_min;

    // |t- K|
    uint64_t d = (t < c->K) ? (c->K - t) : (t - c->K);

    // C * (t - K)^3
    delta = UDX_CONG_C * d * d * d / UDX_CONG_C_SCALE;

    uint32_t target = t < c->K
                        ? c->origin_point - delta
                        : c->origin_point + delta;

    // the higher cnt, the slower it applies...
    c->cnt = target > cwnd
               ? cwnd / (target - cwnd)
               : 100 * cwnd; // ie very slowly
    ;

    // when we have no estimate of current bw make sure to not be too conservative
    if (c->last_cwnd == 0 && c->cnt > 20) {
      c->cnt = 20;
    }
  }

  // check tcp friendly mode

  delta = (UDX_CONG_BETA_SCALE * cwnd) >> 3;

  while (c->ack_cnt > delta) {
    c->ack_cnt -= delta;
    c->tcp_cwnd++;
  }

  if (c->tcp_cwnd > cwnd) {
    delta = c->tcp_cwnd - cwnd;
    uint32_t max_cnt = cwnd / delta;
    if (c->cnt > max_cnt) c->cnt = max_cnt;
  }

  // one update per 2 acks...
  if (c->cnt < 2) c->cnt = 2;
}

static void
clear_incoming_packets (udx_stream_t *stream) {
  uint32_t seq = stream->ack;
  udx_cirbuf_t *inc = &(stream->incoming);

  while (stream->pkts_buffered) {
    udx_pending_read_t *pkt = (udx_pending_read_t *) udx__cirbuf_remove(inc, seq++);
    if (pkt == NULL) continue;

    stream->pkts_buffered--;
    free(pkt);
  }
}

int
udx_stream_write_sizeof (int nwbufs) {
  return sizeof(udx_stream_write_t) + sizeof(udx_stream_write_buf_t) * nwbufs;
}

static void
on_bytes_acked (udx_stream_write_buf_t *wbuf, size_t bytes, bool cancelled) {

  udx_stream_write_t *write = wbuf->write;
  udx_stream_t *stream = write->stream;

  // todo: remove this check? does it matter if we consider them 'not in flight' if we cancel them anyways?
  if (!cancelled) {
    assert(bytes <= wbuf->bytes_inflight);
    wbuf->bytes_inflight -= bytes;
  }
  wbuf->bytes_acked += bytes;
  assert(wbuf->bytes_acked <= wbuf->buf.len);

  write->bytes_acked += bytes;
  assert(write->bytes_acked <= write->size);

  assert(bytes <= stream->writes_queued_bytes);
  stream->writes_queued_bytes -= bytes;

  if (stream->hit_high_watermark && stream->writes_queued_bytes < UDX_HIGH_WATERMARK + cwnd_in_bytes(stream)) {
    stream->hit_high_watermark = false;
    if (stream->on_drain != NULL) stream->on_drain(stream);
  }
}

static void
clear_outgoing_packets (udx_stream_t *stream) {

  // todo: skip the math, and just
  // 1. destroy all packets
  // 2. destroy all wbufs
  // 3. set write->bytes_acked = write->size and call ack(cancel) on all writes

  // We should make sure all existing packets do not send, and notify the user that they failed
  for (uint32_t seq = stream->remote_acked; seq != stream->seq; seq++) {
    udx_packet_t *pkt = (udx_packet_t *) udx__cirbuf_remove(&(stream->outgoing), seq);

    if (pkt == NULL) continue;

    assert(pkt->nbufs >= 2);

    int diff = pkt->nbufs - pkt->nwbufs;
    assert(diff == 1 || diff == 2); // either header buf, or header + padding buff

    uv_buf_t *bufs = (uv_buf_t *) (pkt + 1);

    for (int i = 0; i < pkt->nwbufs; i++) {
      size_t pkt_len = bufs[i + diff].len;
      udx_stream_write_buf_t *wbuf = pkt->wbufs[i];
      on_bytes_acked(wbuf, pkt_len, true);

      // todo: move into on_bytes_acked itself
      udx_stream_write_t *write = wbuf->write;

      if (write->bytes_acked == write->size && write->on_ack) {
        write->on_ack(write, UV_ECANCELED, 0);
      }
    }

    free(pkt);
  }

  while (stream->write_queue.len > 0) {
    udx_stream_write_buf_t *wbuf = udx__fifo_shift(&stream->write_queue);
    assert(wbuf != NULL);
    debug_printf("cancel wbuf: %lu/%lu\n", wbuf->bytes_acked, wbuf->buf.len);

    on_bytes_acked(wbuf, wbuf->buf.len - wbuf->bytes_acked, true);
    // todo: move into on_bytes_acked itself
    udx_stream_write_t *write = wbuf->write;
    if (write->bytes_acked == write->size && write->on_ack) {
      write->on_ack(write, UV_ECANCELED, 0);
    }
  }

  // also clear pending unordered packets, and the destroy packet if waiting
  udx_fifo_t *u = &(stream->unordered);

  while (u->len > 0) {
    udx_packet_t *pkt = udx__fifo_shift(u);
    if (pkt == NULL) continue;

    if (pkt->type == UDX_PACKET_TYPE_STREAM_SEND) {
      udx_stream_send_t *req = pkt->ctx;

      if (req->on_send != NULL) {
        req->on_send(req, UV_ECANCELED);
      }
    }

    if (pkt->type & UDX_PACKET_FREE_ON_SEND) {
      free(pkt);
    }
  }
}

static void
init_stream_packet (udx_packet_t *pkt, int type, udx_stream_t *stream, const uv_buf_t *userbufs, int nuserbufs) {
  uint8_t *b = (uint8_t *) &(pkt->header);

  // 8 bit magic byte + 8 bit version + 8 bit type + 8 bit extensions
  *(b++) = UDX_MAGIC_BYTE;
  *(b++) = UDX_VERSION;
  *(b++) = (uint8_t) type;
  *(b++) = 0; // data offset

  uint32_t *i = (uint32_t *) b;

  // 32 bit (le) remote id
  *(i++) = udx__swap_uint32_if_be(stream->remote_id);
  // 32 bit (le) recv window
  *(i++) = 0xffffffff; // hardcode max recv window
  // 32 bit (le) seq
  *(i++) = udx__swap_uint32_if_be(stream->seq);
  // 32 bit (le) ack
  *(i++) = udx__swap_uint32_if_be(stream->ack);

  pkt->seq = stream->seq;
  pkt->is_retransmit = 0;
  pkt->transmits = 0;
  pkt->size = UDX_HEADER_SIZE;

  pkt->dest = stream->remote_addr;
  pkt->dest_len = stream->remote_addr_len;
  pkt->ctx = stream;
  pkt->is_mtu_probe = false;

  uv_buf_t *bufs = (uv_buf_t *) (pkt + 1);

  pkt->nbufs = 1 + nuserbufs;
  bufs[0] = uv_buf_init((char *) &(pkt->header), UDX_HEADER_SIZE);

  // for now, set when stream writes data
  pkt->wbufs = NULL;
  pkt->nwbufs = 0;

  for (int i = 0; i < nuserbufs; i++) {
    bufs[i + 1] = userbufs[i];
    pkt->size += userbufs[i].len;
  }
}

// returns 1 on success, zero if packet can't be promoted to a probe packet
static int
mtu_probeify_packet (udx_packet_t *pkt, int wanted_size) {
  assert(wanted_size > pkt->size);

  if (pkt->nbufs < 2 || pkt->header[3] != 0) {
    return 0;
  }
  int header_size = (pkt->dest.ss_family == AF_INET ? UDX_IPV4_HEADER_SIZE : UDX_IPV6_HEADER_SIZE) - 20;
  int padding_size = wanted_size - (pkt->size + (pkt->dest.ss_family == AF_INET ? UDX_IPV4_HEADER_SIZE : UDX_IPV6_HEADER_SIZE) - 20);
  if (padding_size > 255) {
    return 0;
  }
  debug_printf("mtu: probeify rid=%u seq=%u size=%u wanted=%d padding=%d\n", udx__swap_uint32_if_be(((unsigned int *) pkt->header)[1]), pkt->seq, pkt->size + header_size, wanted_size, padding_size);
  static char probe_data[256] = {0};

  uv_buf_t *bufs = (uv_buf_t *) (pkt + 1);
  for (int i = pkt->nbufs; i > 1; i--) {
    bufs[i] = bufs[i - 1];
  }
  pkt->nbufs++;

  bufs[1].len = padding_size;
  bufs[1].base = probe_data;

  pkt->header[3] = padding_size;
  pkt->is_mtu_probe = true;
  return 1;
}

// removes probe padding and stream->mtu_probe_wanted
static void
mtu_unprobeify_packet (udx_packet_t *pkt, udx_stream_t *stream) {
  assert(pkt->is_mtu_probe);

  pkt->header[3] = 0;

  uv_buf_t *bufs = (uv_buf_t *) (pkt + 1);

  // [header][padding][2][3] 4 = nbufs

  for (int i = 2; i < pkt->nbufs; i++) {
    bufs[i - 1] = bufs[i];
  }

  pkt->nbufs--;

  pkt->is_mtu_probe = false;

  debug_printf("mtu: probe failed rid=%u %d/%d", stream->remote_id, stream->mtu_probe_count, UDX_MTU_MAX_PROBES);
  if (stream->mtu_state == UDX_MTU_STATE_SEARCH) {
    if (stream->mtu_probe_count >= UDX_MTU_MAX_PROBES) {
      debug_printf(" established mtu=%d via timeout", stream->mtu);
      stream->mtu_state = UDX_MTU_STATE_SEARCH_COMPLETE;
    } else {
      stream->mtu_probe_wanted = true;
    }
  }
  debug_printf("\n");
}

// todo: inefficient

static udx_stream_t *
get_stream (udx_socket_t *socket) {
  for (uint32_t i = 0; i < socket->udx->streams_len; i++) {
    udx_stream_t *stream = socket->udx->streams[i];
    if (stream->socket == socket && stream_write_wanted(stream)) {
      return stream;
    }
  }
  return NULL;
}

// sending packets
// while the socket is writable send until EAGAIN or all packets are sent.
// 1. get a packet to send 'get_packet'. if no packet is available it will return NULL
// 2. if packet sends 'confirm_packet'
//    this frees state packets, shrinks the write_t by the amount sent, etc.
// 3. if packet fails to send call 'undo_packet'
//    undo packet _must_ be called in reverse order of get_packet

udx_packet_t *
udx__shift_packet (udx_socket_t *socket) {

  while (socket->send_queue.len > 0) {
    udx_packet_t *pkt = udx__fifo_shift(&socket->send_queue);
    if (pkt == NULL) {
      continue;
    }
    return pkt;
  }

  udx_stream_t *stream = get_stream(socket);

  if (stream == NULL) {
    return NULL;
  }

  if (stream->unordered.len > 0) {
    udx_packet_t *pkt = udx__fifo_shift(&stream->unordered);
    assert(pkt != NULL);
    return pkt;
  }

  if (stream->write_wanted & UDX_STREAM_WRITE_WANT_STATE) {

    assert(stream->status & UDX_STREAM_CONNECTED);

    uint32_t *sacks = NULL;
    uint32_t start = 0;
    uint32_t end = 0;

    udx_packet_t *pkt = NULL;

    void *payload = NULL;
    size_t payload_len = 0;

    int ooo = stream->out_of_order;

    // 65536 is just a sanity check here in terms of how much max work we wanna do, could prob be smarter
    // only valid if ooo is very large
    for (uint32_t i = 0; i < 65536 && ooo > 0 && payload_len < 400; i++) {
      uint32_t seq = stream->ack + 1 + i;
      if (udx__cirbuf_get(&(stream->incoming), seq) == NULL) continue;

      ooo--;

      if (sacks == NULL) {
        pkt = malloc(sizeof(udx_packet_t) + sizeof(uv_buf_t) * 3 + 1024);
        payload = (((char *) pkt) + sizeof(udx_packet_t) + 3 * sizeof(uv_buf_t));
        sacks = (uint32_t *) payload;
        start = seq;
        end = seq + 1;
      } else if (seq == end) {
        end++;
      } else {
        *(sacks++) = udx__swap_uint32_if_be(start);
        *(sacks++) = udx__swap_uint32_if_be(end);
        start = seq;
        end = seq + 1;
        payload_len += 8;
      }
    }

    if (start != end) {
      *(sacks++) = udx__swap_uint32_if_be(start);
      *(sacks++) = udx__swap_uint32_if_be(end);
      payload_len += 8;
    }

    if (pkt == NULL) pkt = malloc(sizeof(udx_packet_t) + sizeof(uv_buf_t) * 3);

    uv_buf_t buf = uv_buf_init(payload, payload_len);

    // debug_printf("state packet: id dst=%u seq=%u ack=%u\n", stream->remote_id, stream->seq, stream->ack);
    init_stream_packet(pkt, payload ? UDX_HEADER_SACK : 0, stream, &buf, 1);

    pkt->status = UDX_PACKET_STATE_UNCOMMITTED;
    pkt->type = UDX_PACKET_TYPE_STREAM_STATE;
    pkt->ctx = stream;
    pkt->ttl = 0;

    // must clear it here so that we can send a non-state packet
    stream->write_wanted &= ~UDX_STREAM_WRITE_WANT_STATE;

    return pkt;
  }

  if (stream->write_wanted & UDX_STREAM_WRITE_WANT_DESTROY) {
    // todo: pass in pointer to stack to write to instead of malloc
    // for 'free-on-send' packets

    udx_packet_t *pkt = malloc(sizeof(udx_packet_t) + 2 * sizeof(uv_buf_t));

    uv_buf_t buf = uv_buf_init(NULL, 0);

    init_stream_packet(pkt, UDX_HEADER_DESTROY, stream, &buf, 0);

    pkt->status = UDX_PACKET_STATE_UNCOMMITTED;
    pkt->type = UDX_PACKET_TYPE_STREAM_DESTROY;
    pkt->ttl = 0;
    pkt->ctx = stream;

    stream->seq++;

    stream->write_wanted &= ~UDX_STREAM_WRITE_WANT_DESTROY;
    return pkt;
  }

  if (!(stream->status & UDX_STREAM_DEAD) && stream->retransmit_queue.len > 0 && stream->pkts_inflight < stream->cwnd) {

    while (stream->retransmit_queue.len > 0) {
      udx_packet_t *pkt = udx__fifo_shift(&stream->retransmit_queue);
      if (pkt == NULL) continue;
      // pkt == 32?
      stream->pkts_inflight++;
      stream->inflight += pkt->size;

      return pkt;
    }
  }

  if (!(stream->status & UDX_STREAM_DEAD) && stream->write_queue.len > 0 && stream->pkts_inflight < stream->cwnd) {

    // header_flag will be either
    // DATA     - packet has payload and all data written with udx_stream_write()
    // DATA|END - packet has payload and and some or all data was written with udx_stream_write_end()
    // END      - packet has no payload and is the result of udx_stream_write_end() with an empty buffer

    int header_flag = 0;

    uint32_t mss = max_payload(stream);

    uint64_t capacity = mss;

    uv_buf_t bufs[UDX_MAX_COMBINED_WRITES];
    udx_stream_write_buf_t *wbufs[UDX_MAX_COMBINED_WRITES];

    int nwbufs = 0;
    size_t size = 0;

    while (capacity > 0 && nwbufs < UDX_MAX_COMBINED_WRITES && stream->write_queue.len > 0) {
      udx_stream_write_buf_t *wbuf = udx__fifo_peek(&stream->write_queue);

      uv_buf_t *buf = &wbuf->buf;

      uint64_t writesz = buf->len - wbuf->bytes_acked - wbuf->bytes_inflight;

      size_t len = min_uint64(capacity, writesz);
      // printf("len=%lu capacity=%lu writesz=%lu\n", len, capacity, writesz);

      uv_buf_t partial = uv_buf_init(buf->base + wbuf->bytes_acked + wbuf->bytes_inflight, len);
      wbuf->bytes_inflight += len;
      capacity -= len;

      bufs[nwbufs] = partial;
      wbufs[nwbufs] = wbuf;

      size += len;
      nwbufs++;

      if (size > 0) {
        header_flag |= UDX_HEADER_DATA;
      }

      if ((wbuf->bytes_acked + wbuf->bytes_inflight) == wbuf->buf.len) {
        if (wbuf->is_write_end) {
          header_flag |= UDX_HEADER_END;
        }
        udx__fifo_shift(&stream->write_queue);
      }
    }

    assert(header_flag & UDX_HEADER_DATA_OR_END);

    int nbufs = 2 + nwbufs; // extra for 1.header 2.padding

    udx_packet_t *pkt = malloc(sizeof(udx_packet_t) + sizeof(uv_buf_t) * nbufs + sizeof(void *) * nwbufs);

    init_stream_packet(pkt, header_flag, stream, bufs, nwbufs);
    pkt->wbufs = (udx_stream_write_buf_t **) (((uv_buf_t *) (pkt + 1)) + nbufs);
    pkt->nwbufs = nwbufs;

    for (int i = 0; i < nwbufs; i++) {
      pkt->wbufs[i] = wbufs[i];
    }

    pkt->ctx = stream;
    pkt->type = UDX_PACKET_TYPE_STREAM_WRITE;
    pkt->ttl = 0;

    // decrement if packet is unshifted - or move to confirm packet
    stream->seq++;

    if (stream->mtu_probe_wanted && mtu_probeify_packet(pkt, stream->mtu_probe_size)) {
      stream->mtu_probe_count++;
      stream->mtu_probe_wanted = false;
    }

    // undo if unshifted. needed to prevent creating more than cwnd packets
    stream->pkts_inflight++;

    assert(pkt->size > 0 && pkt->size < 1500);
    stream->inflight += pkt->size;

    return pkt;
  }

  return NULL;
}

static int
close_maybe (udx_stream_t *stream, int err) {
  // if BOTH closed or ANY destroyed.
  if ((stream->status & UDX_STREAM_ALL_ENDED) != UDX_STREAM_ALL_ENDED && !(stream->status & UDX_STREAM_ALL_DESTROYED)) return 0;
  // if we already destroyed, bail.
  if (stream->status & UDX_STREAM_CLOSED) return 0;
  // do not close if no error and we have a STATE queued
  if (err == 0 && stream->write_wanted & UDX_STREAM_WRITE_WANT_STATE) return 0;

  stream->status |= UDX_STREAM_CLOSED;
  stream->status &= ~UDX_STREAM_CONNECTED;

  udx_t *udx = stream->udx;

  // Remove from the set, by array[i] = array.pop()
  udx_stream_t *other = udx->streams[--(udx->streams_len)];
  udx->streams[stream->set_id] = other;
  other->set_id = stream->set_id;

  udx__cirbuf_remove(&(udx->streams_by_id), stream->local_id);
  clear_outgoing_packets(stream);
  clear_incoming_packets(stream);

  // TODO: move the instance to a TIME_WAIT state, so we can handle retransmits

  if (stream->status & UDX_STREAM_READING) {
    udx_stream_read_stop(stream);
  }

  udx_stream_t *relay = stream->relay_to;

  if (relay) {
    udx__cirbuf_remove(&(relay->relaying_streams), stream->local_id);
  }

  udx_cirbuf_t relaying = stream->relaying_streams;

  for (uint32_t i = 0; i < relaying.size; i++) {
    udx_stream_t *stream = (udx_stream_t *) relaying.values[i];

    if (stream) {
      stream->relay_to = NULL;
      udx_stream_destroy(stream);
    }
  }

  udx__cirbuf_destroy(&stream->relaying_streams);
  udx__cirbuf_destroy(&stream->incoming);
  udx__cirbuf_destroy(&stream->outgoing);
  udx__fifo_destroy(&stream->unordered);
  udx__fifo_destroy(&stream->write_queue);

  if (stream->on_close != NULL) {
    stream->on_close(stream, err);
  }

  ref_dec(udx);

  return 1;
}

void
udx__confirm_packet (udx_packet_t *pkt) {
  // only count first transmission and RTO retransmits
  // (not rack fast retransmits)
  if (pkt->transmits == 0 || (pkt->status == UDX_PACKET_STATE_RETRANSMIT && pkt->is_retransmit == UDX_SLOW_RETRANSMIT)) {
    pkt->transmits++;
  }
  pkt->status = UDX_PACKET_STATE_INFLIGHT;

  int type = pkt->type;

  if (pkt->type == UDX_PACKET_TYPE_STREAM_WRITE) {
    udx_stream_t *stream = pkt->ctx;

    // if (pkt->transmits > 1) {
    //   debug_printf("retransmit: seq=%u tmit=%d\n", pkt->seq, pkt->transmits);
    // }

    udx__cirbuf_set(&stream->outgoing, (udx_cirbuf_val_t *) pkt);

    assert(seq_compare(stream->seq, pkt->seq) > 0);
  }

  if (pkt->type == UDX_PACKET_TYPE_STREAM_STATE) {
    udx_stream_t *stream = pkt->ctx;
    if (stream->status & UDX_STREAM_ENDED_REMOTE) {
      close_maybe(stream, 0);
    }
  }

  // stream send, socket send and stream destroy
  if (type & UDX_PACKET_CALLBACK) {
    udx__trigger_send_callback(pkt);
    // TODO: watch for re-entry here!
  }

  if (type & UDX_PACKET_FREE_ON_SEND) {
    free(pkt);
  }
}

// called on EAGAIN - return packet to queue
//                    rollback write buffer advance
//                    or re-arm destroy, state flags

void
udx__unshift_packet (udx_packet_t *pkt, udx_socket_t *socket) {

  if (pkt->type == UDX_PACKET_TYPE_SOCKET_SEND || pkt->type == UDX_PACKET_TYPE_STREAM_RELAY) {
    udx__fifo_undo(&socket->send_queue);
    return;
  }

  if (pkt->type == UDX_PACKET_TYPE_STREAM_WRITE) {
    udx_stream_t *stream = pkt->ctx;

    if (pkt->seq + 1 == stream->seq) {
      stream->seq--;
    }

    stream->pkts_inflight--;
    stream->inflight -= pkt->size;

    // todo: optimize: put rollback writes onto the retransmit queue
    // or a 'wait_queue' instead of freeing them

    if (pkt->is_retransmit) {
      // return to the retransmit queue
      udx__fifo_undo(&stream->retransmit_queue);
    } else {
      assert(pkt->transmits == 0);
      // if the packet was the one that shifted a write, undo it

      uv_buf_t *bufs = (uv_buf_t *) (pkt + 1);

      for (int i = 0; i < pkt->nwbufs; i++) {
        udx_stream_write_buf_t *wbuf = pkt->wbufs[i];
        if (wbuf->bytes_acked + wbuf->bytes_inflight == wbuf->buf.len) {
          udx__fifo_undo(&stream->write_queue);
        }

        wbuf->bytes_inflight -= bufs[(pkt->is_mtu_probe ? 2 : 1) + i].len;
      }

      // probe rollback
      if (pkt->is_mtu_probe) {
        // since we delete the packet no need to 'unprobeify' it
        stream->mtu_probe_count--;
        stream->mtu_probe_wanted = true;
      }

      free(pkt);
    }
    return;
  }

  if (pkt->type == UDX_PACKET_TYPE_STREAM_SEND) {
    udx_stream_send_t *req = pkt->ctx;
    udx_stream_t *stream = req->stream;
    udx__fifo_undo(&stream->unordered);
    return;
  }

  if (pkt->type == UDX_PACKET_TYPE_STREAM_STATE) {
    udx_stream_t *stream = pkt->ctx;
    stream->write_wanted |= UDX_STREAM_WRITE_WANT_STATE;
    free(pkt);
    return;
  }

  if (pkt->type == UDX_PACKET_TYPE_STREAM_DESTROY) {
    udx_stream_t *stream = pkt->ctx;
    stream->write_wanted |= UDX_STREAM_WRITE_WANT_DESTROY;
    free(pkt);
    return;
  }
}

// rack recovery implemented using https://datatracker.ietf.org/doc/rfc8985/

static inline bool
rack_sent_after (uint64_t t1, uint32_t seq1, uint64_t t2, uint32_t seq2) {
  return t1 > t2 || (t1 == t2 && seq_compare(seq2, seq1) < 0);
}

static inline uint32_t
rack_update_reo_wnd (udx_stream_t *stream) {
  // TODO: add the DSACK logic also (skipped for now as we didnt impl and only recommended...)

  if (!stream->reordering_seen) {
    if (stream->recovery) return 0;
    if (stream->sacks >= 3) return 0;
  }

  uint32_t r = stream->rack_rtt_min / 4;
  return r < stream->srtt ? r : stream->srtt;
}

static void
rack_detect_loss (udx_stream_t *stream) {
  uint64_t timeout = 0;
  uint32_t reo_wnd = rack_update_reo_wnd(stream);
  uint64_t now = uv_now(stream->udx->loop);

  int resending = 0;
  int mtu_probes_lost = 0;

  for (uint32_t seq = stream->remote_acked; seq != stream->seq; seq++) {
    udx_packet_t *pkt = (udx_packet_t *) udx__cirbuf_get(&stream->outgoing, seq);

    if (pkt == NULL || pkt->status != UDX_PACKET_STATE_INFLIGHT) continue;
    assert(pkt->transmits > 0);

    // debug_printf("%lu > %lu=%d\n", stream->rack_time_sent, pkt->time_sent, stream->rack_time_sent > pkt->time_sent);

    if (!rack_sent_after(stream->rack_time_sent, stream->rack_next_seq, pkt->time_sent, pkt->seq + 1)) {
      continue;
    }

    int64_t remaining = pkt->time_sent + stream->rack_rtt + reo_wnd - now;

    if (remaining <= 0) {
      pkt->status = UDX_PACKET_STATE_RETRANSMIT;
      pkt->is_retransmit = UDX_FAST_RETRANSMIT;

      assert(pkt->size > 0 && pkt->size < 1500);
      stream->inflight -= pkt->size;

      stream->pkts_inflight--;

      if (pkt->is_mtu_probe) {
        mtu_unprobeify_packet(pkt, stream);
        mtu_probes_lost++;
      }

      resending++;
      pkt->fifo_gc = udx__fifo_push(&stream->retransmit_queue, pkt);
    } else if ((uint64_t) remaining > timeout) {
      timeout = remaining;
    }
  }

  if (resending > mtu_probes_lost) {
    debug_printf("rack: rid=%u lost=%d mtu_probe_lost=%d\n", stream->remote_id, resending, mtu_probes_lost);
    if (stream->recovery == 0) {
      // debug_print_outgoing(stream);

      // recover until the full window is acked
      stream->recovery = seq_diff(stream->seq, stream->remote_acked);

      // only reduce congestion window if more than just the mtu probe was lost
      reduce_cwnd(stream, false);

      debug_printf("rack: fast recovery rid=%u start=[%u:%u] (%u pkts) inflight=%zu cwnd=%u srtt=%u\n", stream->remote_id, stream->remote_acked, stream->seq, stream->recovery, stream->inflight, stream->cwnd, stream->srtt);
    }
  }

  update_poll(stream->socket);
  stream->rack_timeout = timeout;
}

static void
ack_update (udx_stream_t *stream, uint32_t acked, bool is_limited) {
  uint64_t time = uv_now(stream->udx->loop);

  // also reset rto, since things are moving forward...
  stream->rto_timeout = time + stream->rto;

  udx_cong_t *c = &(stream->cong);

  // If we are application limited, just reset the epic and return...
  // The delay_min check here, was added due to massive latency increase (ie multiple seconds) due to router buffering
  // Perhaps research other approaches for this, but since delay_min is adjusted based on congestion this seems OK but
  // but surely better ways exists for this
  if (is_limited || stream->recovery || (c->delay_min > 0 && stream->srtt > c->delay_min * 4)) {
    c->start_time = 0;
    return;
  }

  if (c->delay_min == 0 || c->delay_min > stream->srtt) {
    c->delay_min = stream->srtt;
  }

  if (stream->cwnd < stream->ssthresh) {
    stream->cwnd += acked;
    if (stream->cwnd > stream->ssthresh) stream->cwnd = stream->ssthresh;
  } else {
    update_congestion(c, stream->cwnd, acked, time);
    increase_cwnd(stream, c->cnt, acked);
  }

  debug_print_cwnd_stats(stream);
}

static int
ack_packet (udx_stream_t *stream, uint32_t seq, int sack) {
  udx_cirbuf_t *out = &(stream->outgoing);
  udx_packet_t *pkt = (udx_packet_t *) udx__cirbuf_remove(out, seq);

  if (pkt == NULL) {
    if (!sack) stream->sacks--; // packet not here, was sacked before
    return 0;
  }

  if (stream->mtu_state == UDX_MTU_STATE_SEARCH && stream->mtu_probe_count > 0 && pkt->is_mtu_probe) {
    debug_printf("mtu: probe acked rid=%u seq=%u mtu=%d->%d sack=%d\n", stream->remote_id, seq, stream->mtu, stream->mtu_probe_size, sack);

    stream->mtu_probe_count = 0;
    stream->mtu = stream->mtu_probe_size;

    if (stream->mtu_probe_size == stream->mtu_max) {
      stream->mtu_state = UDX_MTU_STATE_SEARCH_COMPLETE;
    } else {
      stream->mtu_probe_size += UDX_MTU_STEP;
      if (stream->mtu_probe_size >= stream->mtu_max) {
        stream->mtu_probe_size = stream->mtu_max;
      }
      stream->mtu_probe_wanted = true;
    }
  }

  if (stream->mtu_state == UDX_MTU_STATE_BASE || stream->mtu_state == UDX_MTU_STATE_ERROR) {
    stream->mtu_state = UDX_MTU_STATE_SEARCH;
    stream->mtu_probe_wanted = true;
  }

  if (sack) {
    stream->sacks++;
  }

  if (pkt->status == UDX_PACKET_STATE_RETRANSMIT) {
    udx__fifo_remove(&stream->retransmit_queue, pkt, pkt->fifo_gc);
  } else {
    stream->pkts_inflight--;
    stream->inflight -= pkt->size;
  }

  const uint64_t time = uv_now(stream->udx->loop);
  const uint32_t rtt = (uint32_t) (time - pkt->time_sent);
  const uint32_t next = seq + 1;

  if (seq_compare(stream->rack_fack, next) < 0) {
    stream->rack_fack = next;
  } else if (seq_compare(next, stream->rack_fack) < 0 && pkt->transmits == 1) {
    stream->reordering_seen = true;
  }

  if (pkt->status == UDX_PACKET_STATE_INFLIGHT && pkt->transmits == 1) {
    if (stream->rack_rtt_min == 0 || stream->rack_rtt_min > rtt) {
      stream->rack_rtt_min = rtt;
    }

    // First round trip time sample
    if (stream->srtt == 0) {
      stream->srtt = rtt;
      stream->rttvar = rtt / 2;
    } else {
      const uint32_t delta = rtt < stream->srtt ? stream->srtt - rtt : rtt - stream->srtt;
      // RTTVAR <- (1 - beta) * RTTVAR + beta * |SRTT - R'| where beta is 1/4
      stream->rttvar = (3 * stream->rttvar + delta) / 4;

      // SRTT <- (1 - alpha) * SRTT + alpha * R' where alpha is 1/8
      stream->srtt = (7 * stream->srtt + rtt) / 8;
    }

    // RTO <- SRTT + max (G, K*RTTVAR) where K is 4 maxed with 1s
    stream->rto = max_uint32(stream->srtt + max_uint32(UDX_CLOCK_GRANULARITY_MS, 4 * stream->rttvar), 1000);
  }

  if (pkt->status == UDX_PACKET_STATE_INFLIGHT && (pkt->transmits == 1 || (rtt >= stream->rack_rtt_min && stream->rack_rtt_min > 0))) {
    stream->rack_rtt = rtt;

    if (rack_sent_after(pkt->time_sent, next, stream->rack_time_sent, stream->rack_next_seq)) {
      stream->rack_time_sent = pkt->time_sent;
      stream->rack_next_seq = next;
    }
  }

  int diff = pkt->nbufs - pkt->nwbufs;

  uv_buf_t *bufs = (uv_buf_t *) (pkt + 1);

  for (int i = 0; i < pkt->nwbufs; i++) {

    size_t pkt_len = bufs[i + diff].len;
    udx_stream_write_buf_t *wbuf = pkt->wbufs[i];

    on_bytes_acked(wbuf, pkt_len, false);

    udx_stream_write_t *write = wbuf->write;

    if (write->bytes_acked == write->size && write->on_ack) {
      write->on_ack(write, 0, sack);
    }
  }

  free(pkt);

  // debug_printf("pkt_len=%lu write->bytes_acked=%lu write->size=%lu\n", pkt_len, writewrite>bytes_acked, write->buf.len);

  if (stream->status & UDX_STREAM_DEAD) return 2;

  // TODO: the end condition needs work here to be more "stateless"
  // ie if the remote has acked all our writes, then instead of waiting for retransmits, we should
  // clear those and mark as local ended NOW.
  if ((stream->status & UDX_STREAM_SHOULD_END) == UDX_STREAM_END && stream->pkts_inflight == 0 && stream->retransmit_queue.len == 0 && stream->write_queue.len == 0) {
    stream->status |= UDX_STREAM_ENDED;
    return 2;
  }

  return 1;
}

static uint32_t
process_sacks (udx_stream_t *stream, char *buf, size_t buf_len) {
  uint32_t n = 0;
  uint32_t *sacks = (uint32_t *) buf;

  for (size_t i = 0; i + 8 <= buf_len; i += 8) {
    uint32_t start = udx__swap_uint32_if_be(*(sacks++));
    uint32_t end = udx__swap_uint32_if_be(*(sacks++));
    int32_t len = seq_diff(end, start);

    for (int32_t j = 0; j < len; j++) {
      int a = ack_packet(stream, start + j, 1);
      if (a == 2) return 0; // ended
      if (a == 1) {
        n++;
      }
    }
  }

  return n;
}

static void
process_data_packet (udx_stream_t *stream, int type, uint32_t seq, char *data, ssize_t data_len) {
  if (seq == stream->ack && type == UDX_HEADER_DATA) {
    // Fast path - next in line, no need to memcpy it, stack allocate the struct and call on_read...
    stream->ack++;

    stream->write_wanted |= UDX_STREAM_WRITE_WANT_STATE;
    if (stream->socket != NULL) {
      update_poll(stream->socket);
    }

    if (stream->on_read != NULL) {
      uv_buf_t buf = uv_buf_init(data, data_len);
      stream->on_read(stream, data_len, &buf);
    }
    return;
  }

  stream->out_of_order++;

  // Slow path, packet out of order.
  // Copy over incoming buffer as we do not own it (stack allocated upstream)
  char *ptr = malloc(sizeof(udx_pending_read_t) + data_len);

  udx_pending_read_t *pkt = (udx_pending_read_t *) ptr;
  char *cpy = ptr + sizeof(udx_pending_read_t);

  memcpy(cpy, data, data_len);

  pkt->type = type;
  pkt->seq = seq;
  pkt->buf.base = cpy;
  pkt->buf.len = data_len;

  stream->pkts_buffered++;
  udx__cirbuf_set(&(stream->incoming), (udx_cirbuf_val_t *) pkt);
}

static int
relay_packet (udx_stream_t *stream, char *buf, ssize_t buf_len, int type, uint8_t data_offset, uint32_t seq, uint32_t ack) {
  stream->seq = seq_max(stream->seq, seq);

  udx_stream_t *relay = stream->relay_to;

  if (relay->socket != NULL) {
    uint32_t *h = (uint32_t *) buf;
    h[1] = udx__swap_uint32_if_be(relay->remote_id);

    uv_buf_t b = uv_buf_init(buf, buf_len);

    int err = udx__sendmsg(relay->socket, &b, 1, (struct sockaddr *) &relay->remote_addr, relay->remote_addr_len);

    if (err == EAGAIN) {
      b.base += UDX_HEADER_SIZE;
      b.len -= UDX_HEADER_SIZE;

      udx_packet_t *pkt = malloc(sizeof(udx_packet_t) + 3 * sizeof(uv_buf_t) + b.len);
      memcpy((char *) pkt + sizeof(udx_packet_t) + 3 * sizeof(uv_buf_t), b.base, b.len);
      b.base = (char *) pkt + sizeof(udx_packet_t) + 3 * sizeof(uv_buf_t);

      init_stream_packet(pkt, type, relay, &b, 1);

      h = (uint32_t *) &(pkt->header);
      h[3] = udx__swap_uint32_if_be(seq);
      h[4] = udx__swap_uint32_if_be(ack);

      pkt->status = UDX_PACKET_STATE_UNCOMMITTED;
      pkt->type = UDX_PACKET_TYPE_STREAM_RELAY;
      pkt->header[3] = data_offset;
      pkt->seq = seq;

      udx__fifo_push(&relay->socket->send_queue, pkt);
      update_poll(relay->socket);
    }
  }

  if (type & UDX_HEADER_DESTROY) {
    stream->status |= UDX_STREAM_DESTROYED_REMOTE;
    close_maybe(stream, UV_ECONNRESET);
  }

  return 1;
}

static int
process_packet (udx_socket_t *socket, char *buf, ssize_t buf_len, struct sockaddr *addr) {

  if (buf_len < UDX_HEADER_SIZE) return 0;

  uint8_t *b = (uint8_t *) buf;

  if ((*(b++) != UDX_MAGIC_BYTE) || (*(b++) != UDX_VERSION)) return 0;

  int type = (int) *(b++);
  uint8_t data_offset = *(b++);

  uint32_t *i = (uint32_t *) b;

  uint32_t local_id = udx__swap_uint32_if_be(*(i++));
  /* recv_win */ udx__swap_uint32_if_be(*(i++));
  uint32_t seq = udx__swap_uint32_if_be(*(i++));
  uint32_t ack = udx__swap_uint32_if_be(*i);

  udx_stream_t *stream = (udx_stream_t *) udx__cirbuf_get(socket->streams_by_id, local_id);

  if (stream == NULL || stream->status & UDX_STREAM_DEAD) return 0;

  // We expect this to be a stream packet from now on
  if (stream->socket != socket && stream->on_firewall != NULL) {
    if (is_addr_v4_mapped((struct sockaddr *) addr)) {
      addr_to_v4((struct sockaddr_in6 *) addr);
    }

    if (stream->on_firewall(stream, socket, addr)) return 1;
  }

  if (stream->relay_to) return relay_packet(stream, buf, buf_len, type, data_offset, seq, ack);

  buf += UDX_HEADER_SIZE;
  buf_len -= UDX_HEADER_SIZE;

  size_t header_len = (data_offset > 0 && data_offset < buf_len) ? data_offset : buf_len;

  bool sacked = (type & UDX_HEADER_SACK) ? process_sacks(stream, buf, header_len) > 0 : false;

  // Done with header processing now.
  // For future compat, make sure we are now pointing at the actual data using the data_offset
  if (data_offset) {
    if (data_offset > buf_len) return 1;
    buf += data_offset;
    buf_len -= data_offset;
  }

  udx_cirbuf_t *inc = &(stream->incoming);

  // For all stream packets, ensure that they are causally newer (or same)
  if (seq_compare(stream->ack, seq) <= 0) {
    if (type & UDX_HEADER_DATA_OR_END && udx__cirbuf_get(inc, seq) == NULL && (stream->status & UDX_STREAM_SHOULD_READ) == UDX_STREAM_READ) {
      process_data_packet(stream, type, seq, buf, buf_len);
    }

    if (type & UDX_HEADER_END) {
      stream->status |= UDX_STREAM_ENDING_REMOTE;
      stream->remote_ended = seq;
    }

    if (type & UDX_HEADER_DESTROY) {
      stream->status |= UDX_STREAM_DESTROYED_REMOTE;
      close_maybe(stream, UV_ECONNRESET);
      return 1;
    }
  }

  if (type & UDX_HEADER_MESSAGE) {
    if (stream->on_recv != NULL) {
      uv_buf_t b = uv_buf_init(buf, buf_len);
      stream->on_recv(stream, buf_len, &b);
    }
  }

  // process the (out of order) read queue
  while ((stream->status & UDX_STREAM_SHOULD_READ) == UDX_STREAM_READ) {
    udx_pending_read_t *pkt = (udx_pending_read_t *) udx__cirbuf_remove(inc, stream->ack);
    if (pkt == NULL) break;

    stream->out_of_order--;
    stream->pkts_buffered--;
    stream->ack++;

    if ((pkt->type & UDX_HEADER_DATA) && stream->on_read != NULL) {
      stream->on_read(stream, pkt->buf.len, &(pkt->buf));
    }

    free(pkt);
  }

  // Check if the ack is oob.
  if (seq_compare(stream->seq, ack) < 0) {
    return 1;
  }

  if (stream->remote_changing && seq_diff(ack, stream->seq_on_remote_changed) >= 0) {
    debug_printf("remote_change: packets to old remote acked. ack=%u, last=%u, seq_diff=%d\n", ack, stream->seq_on_remote_changed, seq_diff(ack, stream->seq_on_remote_changed));
    stream->remote_changing = false;
    if (stream->on_remote_changed) {
      stream->on_remote_changed(stream);
    }
  }

  int32_t len = seq_diff(ack, stream->remote_acked);
  bool is_limited = stream->recovery;

  for (int32_t j = 0; j < len; j++) {
    if (stream->recovery > 0 && --(stream->recovery) == 0) {
      // The end of fast recovery, adjust according to the spec (unsure if we need this as we do not modify cwnd during recovery but oh well...)
      if (stream->ssthresh < stream->cwnd) stream->cwnd = stream->ssthresh;

      debug_printf("rack: fast recovery ended rid=%u inflight=%zu, cwnd=%u, acked=%u, seq=%u\n", stream->remote_id, stream->inflight, stream->cwnd, stream->remote_acked + 1, stream->seq);
    }

    int a = ack_packet(stream, stream->remote_acked++, 0);

    if (a == 0 || a == 1) continue;
    if (a == 2) { // it ended, so ack that and trigger close
      // TODO: make this work as well, if the ack packet is lost, ie
      // have some internal (capped) queue of "gracefully closed" streams (TIME_WAIT)

      // original code:
      // send_state_packet(stream);
      // close_maybe(stream, 0);

      stream->write_wanted |= UDX_STREAM_WRITE_WANT_STATE;
      update_poll(stream->socket);
      close_maybe(stream, 0);
    }
    return 1;
  }

  // we are user limited if queued bytes (that includes current inflight + a max packet) is less than the window
  if (!is_limited) is_limited = stream->writes_queued_bytes + max_payload(stream) < cwnd_in_bytes(stream);

  if (len > 0) {
    ack_update(stream, len, is_limited);
    rack_detect_loss(stream);
  } else if (sacked) {
    rack_detect_loss(stream);
  }

  if (type & UDX_HEADER_DATA_OR_END) {
    stream->write_wanted |= UDX_STREAM_WRITE_WANT_STATE;
    if (stream->status & UDX_STREAM_CONNECTED) {
      assert(stream->socket != NULL);
      update_poll(stream->socket);
    }
  }

  if ((stream->status & UDX_STREAM_SHOULD_END_REMOTE) == UDX_STREAM_END_REMOTE && seq_compare(stream->remote_ended, stream->ack) <= 0) {
    stream->status |= UDX_STREAM_ENDED_REMOTE;
    if (stream->on_read != NULL) {
      uv_buf_t b = uv_buf_init(NULL, 0);
      stream->on_read(stream, UV_EOF, &b);
    }
    // if (close_maybe(stream, 0)) return 1;
  } else { // no need to check timeouts if we're ending after sending ack regardless
    if (stream->pkts_inflight > 0) {
      udx_stream_check_timeouts(stream);
    }
  }

  return 1;
}

void
udx__trigger_send_callback (udx_packet_t *pkt) {
  if (pkt->type == UDX_PACKET_TYPE_SOCKET_SEND) {
    udx_socket_send_t *req = pkt->ctx;

    if (req->on_send != NULL) {
      req->on_send(req, 0);
    }
    return;
  }

  if (pkt->type == UDX_PACKET_TYPE_STREAM_SEND) {
    udx_stream_send_t *req = pkt->ctx;

    if (req->on_send != NULL) {
      req->on_send(req, 0);
    }
    return;
  }

  if (pkt->type == UDX_PACKET_TYPE_STREAM_DESTROY) {
    udx_stream_t *stream = pkt->ctx;

    stream->status |= UDX_STREAM_DESTROYED;
    stream->write_wanted &= ~UDX_STREAM_WRITE_WANT_DESTROY;
    close_maybe(stream, 0);
    return;
  }
}

static bool
check_if_streams_have_data (udx_socket_t *socket) {
  for (uint32_t i = 0; i < socket->udx->streams_len; i++) {
    udx_stream_t *stream = socket->udx->streams[i];
    if (stream->socket == socket && (stream->unordered.len > 0 || stream->write_queue.len > 0 || stream->retransmit_queue.len > 0 || stream->write_wanted)) {
      return true;
    }
  }
  return false;
}

static void
on_uv_poll (uv_poll_t *handle, int status, int events) {
  UDX_UNUSED(status);
  udx_socket_t *socket = handle->data;
  ssize_t size;

  if (events & UV_READABLE) {
    struct sockaddr_storage addr;
    int addr_len = sizeof(addr);
    uv_buf_t buf;

    memset(&addr, 0, addr_len);

    char b[2048];
    buf.base = (char *) &b;
    buf.len = 2048;

    while (!(socket->status & UDX_SOCKET_CLOSING_HANDLES) && (size = udx__recvmsg(socket, &buf, (struct sockaddr *) &addr, addr_len)) >= 0) {
      if (!process_packet(socket, b, size, (struct sockaddr *) &addr) && socket->on_recv != NULL) {
        buf.len = size;

        if (is_addr_v4_mapped((struct sockaddr *) &addr)) {
          addr_to_v4((struct sockaddr_in6 *) &addr);
        }

        socket->on_recv(socket, size, &buf, (struct sockaddr *) &addr);
      }

      buf.len = 2048;
    }
  }

  if (events & UV_WRITABLE && !(socket->status & UDX_SOCKET_CLOSING_HANDLES)) {
    if (events & UV_READABLE) {
      // compensate for potentially long-running read callbacks
      uv_update_time(handle->loop);
    }
    udx__on_writable(socket);
    if (socket->status & UDX_SOCKET_CLOSING && socket->send_queue.len == 0 && !check_if_streams_have_data(socket)) {
      udx__close_handles(socket);
    }
  }

  // update the poll if the socket is still active.
  if (uv_is_active((uv_handle_t *) &socket->io_poll)) {
    update_poll(socket);
  }
}

int
udx_init (uv_loop_t *loop, udx_t *handle) {
  handle->refs = 0;
  handle->sockets = 0;
  handle->timer_closed_by = NULL;

  handle->streams_len = 0;
  handle->streams_max_len = 0;
  handle->streams = NULL;

  handle->loop = loop;

  return 0;
}

int
udx_check_timeouts (udx_t *udx) {
  for (uint32_t i = 0; i < udx->streams_len; i++) {
    int err = udx_stream_check_timeouts(udx->streams[i]);
    if (err < 0) return err;
    if (err == 1) i--; // stream was closed, the index again
  }
  return 0;
}

int
udx_socket_init (udx_t *udx, udx_socket_t *socket) {
  ref_inc(udx);

  socket->family = 0;
  socket->status = 0;
  socket->events = 0;
  socket->pending_closes = 0;
  socket->ttl = UDX_DEFAULT_TTL;

  socket->udx = udx;
  socket->streams_by_id = &(udx->streams_by_id);

  udx->sockets++;

  // If first open...
  if (udx->sockets == 1 && udx->timer_closed_by == NULL) {
    // Asserting all the errors here as it massively simplifies error handling.
    // In practice these will never fail.
    udx_start_timer(udx);
  }

  socket->on_recv = NULL;
  socket->on_close = NULL;

  udx__fifo_init(&(socket->send_queue), 16);

  uv_udp_t *handle = &(socket->handle);

  // Asserting all the errors here as it massively simplifies error handling.
  // In practice these will never fail.

  int err = uv_udp_init(udx->loop, handle);
  assert(err == 0);

  handle->data = socket;

  return err;
}

int
udx_socket_get_send_buffer_size (udx_socket_t *socket, int *value) {
  *value = 0;
  return uv_send_buffer_size((uv_handle_t *) &(socket->handle), value);
}

int
udx_socket_set_send_buffer_size (udx_socket_t *socket, int value) {
  if (value < 1) return UV_EINVAL;
  return uv_send_buffer_size((uv_handle_t *) &(socket->handle), &value);
}

int
udx_socket_get_recv_buffer_size (udx_socket_t *socket, int *value) {
  *value = 0;
  return uv_recv_buffer_size((uv_handle_t *) &(socket->handle), value);
}

int
udx_socket_set_recv_buffer_size (udx_socket_t *socket, int value) {
  if (value < 1) return UV_EINVAL;
  return uv_recv_buffer_size((uv_handle_t *) &(socket->handle), &value);
}

int
udx_socket_get_ttl (udx_socket_t *socket, int *ttl) {
  *ttl = socket->ttl;
  return 0;
}

int
udx_socket_set_ttl (udx_socket_t *socket, int ttl) {
  if (ttl < 1 || ttl > 255) return UV_EINVAL;
  socket->ttl = ttl;
  return uv_udp_set_ttl((uv_udp_t *) &(socket->handle), ttl);
}

int
udx_socket_bind (udx_socket_t *socket, const struct sockaddr *addr, unsigned int flags) {
  uv_udp_t *handle = &(socket->handle);
  uv_poll_t *poll = &(socket->io_poll);
  uv_os_fd_t fd;

  if (addr->sa_family == AF_INET) {
    socket->family = 4;
  } else if (addr->sa_family == AF_INET6) {
    socket->family = 6;
  } else {
    return UV_EINVAL;
  }

  // This might actually fail in practice, so
  int err = uv_udp_bind(handle, addr, flags);
  if (err) return err;

  // Asserting all the errors here as it massively simplifies error handling
  // and in practice non of these will fail, as all our handles are valid and alive.

  err = uv_udp_set_ttl(handle, socket->ttl);
  assert(err == 0);

  int send_buffer_size = UDX_DEFAULT_BUFFER_SIZE;
  err = uv_send_buffer_size((uv_handle_t *) handle, &send_buffer_size);
  assert(err == 0);

  int recv_buffer_size = UDX_DEFAULT_BUFFER_SIZE;
  err = uv_recv_buffer_size((uv_handle_t *) handle, &recv_buffer_size);
  assert(err == 0);

  err = uv_fileno((const uv_handle_t *) handle, &fd);
  assert(err == 0);

  err = uv_poll_init_socket(socket->udx->loop, poll, fd);
  assert(err == 0);

  socket->status |= UDX_SOCKET_BOUND;
  poll->data = socket;

  return update_poll(socket);
}

int
udx_socket_getsockname (udx_socket_t *socket, struct sockaddr *name, int *name_len) {
  return uv_udp_getsockname(&(socket->handle), name, name_len);
}

int
udx_socket_send (udx_socket_send_t *req, udx_socket_t *socket, const uv_buf_t bufs[], unsigned int bufs_len, const struct sockaddr *dest, udx_socket_send_cb cb) {
  return udx_socket_send_ttl(req, socket, bufs, bufs_len, dest, 0, cb);
}

int
udx_socket_send_ttl (udx_socket_send_t *req, udx_socket_t *socket, const uv_buf_t bufs[], unsigned int bufs_len, const struct sockaddr *dest, int ttl, udx_socket_send_cb cb) {
  if (ttl < 0 /* 0 is "default" */ || ttl > 255) return UV_EINVAL;

  assert(bufs_len == 1);

  req->socket = socket;
  req->on_send = cb;

  udx_packet_t *pkt = &req->pkt;

  // pkt->status = UDX_PACKET_STATE_UNCOMMITTED;
  pkt->type = UDX_PACKET_TYPE_SOCKET_SEND;
  pkt->ttl = ttl;
  pkt->ctx = req;

  if (dest->sa_family == AF_INET) {
    pkt->dest_len = sizeof(struct sockaddr_in);
  } else if (dest->sa_family == AF_INET6) {
    pkt->dest_len = sizeof(struct sockaddr_in6);
  } else {
    return UV_EINVAL;
  }

  memcpy(&(pkt->dest), dest, pkt->dest_len);

  pkt->is_retransmit = 0;
  pkt->transmits = 0;

  pkt->nbufs = 1;

  uv_buf_t *buf = (uv_buf_t *) (pkt + 1);

  assert(buf == &req->bufs[0]);

  buf[0] = bufs[0];

  // pkt->send_queue = &socket->send_queue;
  pkt->fifo_gc = udx__fifo_push(&socket->send_queue, pkt);
  return update_poll(socket);
}

int
udx_socket_recv_start (udx_socket_t *socket, udx_socket_recv_cb cb) {
  if (socket->status & UDX_SOCKET_RECEIVING) return UV_EALREADY;

  socket->on_recv = cb;
  socket->status |= UDX_SOCKET_RECEIVING;

  return update_poll(socket);
}

int
udx_socket_recv_stop (udx_socket_t *socket) {
  if ((socket->status & UDX_SOCKET_RECEIVING) == 0) return 0;

  socket->on_recv = NULL;
  socket->status ^= UDX_SOCKET_RECEIVING;

  return update_poll(socket);
}

int
udx_socket_close (udx_socket_t *socket, udx_socket_close_cb cb) {
  // if (socket->streams_len > 0) return UV_EBUSY;

  socket->status |= UDX_SOCKET_CLOSING;

  socket->on_close = cb;

  // allow stream packets to flush, but cancel anything else

  while (socket->send_queue.len > 0) {
    udx_packet_t *pkt = udx__fifo_shift(&socket->send_queue);
    assert(pkt != NULL);
    assert(pkt->type == UDX_PACKET_TYPE_SOCKET_SEND);

    udx_socket_send_t *req = pkt->ctx;
    if (req->on_send) {
      req->on_send(req, UV_ECANCELED);
    }
  }

  if (!check_if_streams_have_data(socket)) {
    udx__close_handles(socket);
  }

  return 0;
}

int
udx_stream_init (udx_t *udx, udx_stream_t *stream, uint32_t local_id, udx_stream_close_cb close_cb) {
  ref_inc(udx);

  stream->local_id = local_id;
  stream->remote_id = 0;
  stream->set_id = 0;
  stream->status = 0;
  stream->write_wanted = 0;
  stream->out_of_order = 0;
  stream->recovery = 0;
  stream->socket = NULL;
  stream->relayed = false;
  stream->relay_to = NULL;
  stream->udx = udx;

  stream->reordering_seen = false;
  stream->retransmitting = 0;

  stream->hit_high_watermark = false;
  stream->writes_queued_bytes = 0;

  stream->remote_changing = false;
  stream->on_remote_changed = NULL;
  stream->seq_on_remote_changed = 0;

  stream->mtu = UDX_MTU_BASE;
  stream->mtu_state = UDX_MTU_STATE_BASE;
  stream->mtu_probe_wanted = false;
  stream->mtu_probe_count = 0;
  stream->mtu_probe_size = UDX_MTU_BASE; // starts with first ack, counts as a confirmation of base
  stream->mtu_max = UDX_MTU_MAX;         // revised in connect()

  stream->seq = 0;
  stream->ack = 0;
  stream->remote_acked = 0;

  stream->srtt = 0;
  stream->rttvar = 0;
  stream->rto = 1000;
  stream->rto_timeout = uv_now(udx->loop) + stream->rto;
  stream->rack_timeout = 0;

  stream->rack_rtt_min = 0;
  stream->rack_rtt = 0;
  stream->rack_time_sent = 0;
  stream->rack_next_seq = 0;
  stream->rack_fack = 0;

  stream->deferred_ack = 0;

  stream->pkts_inflight = 0;
  stream->pkts_buffered = 0;

  stream->sacks = 0;
  stream->inflight = 0;
  stream->ssthresh = 255;
  stream->cwnd = UDX_CONG_INIT_CWND;
  stream->cwnd_cnt = 0;
  stream->rwnd = 0;

  stream->on_firewall = NULL;
  stream->on_read = NULL;
  stream->on_recv = NULL;
  stream->on_drain = NULL;
  stream->on_close = close_cb;

  // Clear congestion state
  memset(&(stream->cong), 0, sizeof(udx_cong_t));

  udx__cirbuf_init(&(stream->relaying_streams), 2);

  // Init stream write/read buffers
  udx__cirbuf_init(&(stream->outgoing), 16);
  udx__cirbuf_init(&(stream->incoming), 16);
  udx__fifo_init(&(stream->unordered), 1);

  udx__fifo_init(&stream->write_queue, 1);
  udx__fifo_init(&stream->retransmit_queue, 1);

  stream->set_id = udx->streams_len++;

  if (udx->streams_len == udx->streams_max_len) {
    udx->streams_max_len *= 2;
    udx->streams = realloc(udx->streams, udx->streams_max_len * sizeof(udx_stream_t *));
  }

  udx->streams[stream->set_id] = stream;

  // Add the socket to the active set

  udx__cirbuf_set(&(udx->streams_by_id), (udx_cirbuf_val_t *) stream);

  return 0;
}

int
udx_stream_get_mtu (udx_stream_t *stream, uint16_t *mtu) {
  *mtu = stream->mtu;
  return 0;
}

int
udx_stream_get_seq (udx_stream_t *stream, uint32_t *seq) {
  *seq = stream->seq;
  return 0;
}

int
udx_stream_set_seq (udx_stream_t *stream, uint32_t seq) {
  stream->seq = seq;
  stream->remote_acked = seq;
  return 0;
}

int
udx_stream_get_ack (udx_stream_t *stream, uint32_t *ack) {
  *ack = stream->ack;
  return 0;
}

int
udx_stream_set_ack (udx_stream_t *stream, uint32_t ack) {
  stream->ack = ack;
  return 0;
}

int
udx_stream_firewall (udx_stream_t *stream, udx_stream_firewall_cb cb) {
  stream->on_firewall = cb;
  return 0;
}

int
udx_stream_recv_start (udx_stream_t *stream, udx_stream_recv_cb cb) {
  if (stream->status & UDX_STREAM_RECEIVING) return UV_EALREADY;

  stream->on_recv = cb;
  stream->status |= UDX_STREAM_RECEIVING;

  return stream->socket == NULL ? 0 : update_poll(stream->socket);
}

int
udx_stream_recv_stop (udx_stream_t *stream) {
  if ((stream->status & UDX_STREAM_RECEIVING) == 0) return 0;

  stream->on_recv = NULL;
  stream->status ^= UDX_STREAM_RECEIVING;

  return stream->socket == NULL ? 0 : update_poll(stream->socket);
}

int
udx_stream_read_start (udx_stream_t *stream, udx_stream_read_cb cb) {
  if (stream->status & UDX_STREAM_READING) return UV_EALREADY;

  stream->on_read = cb;
  stream->status |= UDX_STREAM_READING;

  return stream->socket == NULL ? 0 : update_poll(stream->socket);
}

int
udx_stream_read_stop (udx_stream_t *stream) {
  if ((stream->status & UDX_STREAM_READING) == 0) return 0;

  stream->on_read = NULL;
  stream->status ^= UDX_STREAM_READING;

  return stream->socket == NULL ? 0 : update_poll(stream->socket);
}

int
udx_stream_check_timeouts (udx_stream_t *stream) {
  if ((stream->status & UDX_STREAM_CONNECTED) == 0) {
    return 0;
  }

  if (stream->remote_acked == stream->seq && stream->write_queue.len == 0) {
    return 0;
  }

  const uint64_t now = stream->inflight ? uv_now(stream->udx->loop) : 0;

  if (stream->rack_timeout > 0 && now >= stream->rack_timeout) {
    rack_detect_loss(stream);
  }

  if (now > stream->rto_timeout) {
    // Bail out of fast recovery mode if we are in it
    stream->recovery = 0;
    // clear out old retransmit queue
    while (stream->retransmit_queue.len > 0) {
      udx__fifo_shift(&stream->retransmit_queue);
    }

    // Reduce the congestion window (full reset)
    reduce_cwnd(stream, true);

    // Ensure it backs off until data is acked...
    stream->rto_timeout = now + 2 * stream->rto;

    // Consider all packets lost - seems to be the simple consensus across different stream impls
    // which we like cause it is nice and simple to implement.
    debug_printf("rto: lost rid=%u [%u:%u] inflight=%lu ssthresh=%u cwnd=%u srtt=%u\n", stream->remote_id, stream->remote_acked, stream->seq, stream->inflight, stream->ssthresh, stream->cwnd, stream->srtt);

    for (uint32_t seq = stream->remote_acked; seq < stream->seq; seq++) {

      udx_packet_t *pkt = (udx_packet_t *) udx__cirbuf_get(&stream->outgoing, seq);
      if (pkt == NULL) continue;

      if (pkt->status == UDX_PACKET_STATE_RETRANSMIT) {
        pkt->fifo_gc = udx__fifo_push(&stream->retransmit_queue, pkt);
        continue;
      }

      if (pkt == NULL || pkt->status != UDX_PACKET_STATE_INFLIGHT) {
        continue;
      }

      if (pkt->transmits >= UDX_MAX_TRANSMITS) {
        stream->status |= UDX_STREAM_DESTROYED;
        close_maybe(stream, UV_ETIMEDOUT);
        return 1;
      }

      pkt->status = UDX_PACKET_STATE_RETRANSMIT;
      pkt->is_retransmit = UDX_SLOW_RETRANSMIT;

      stream->inflight -= pkt->size;
      stream->pkts_inflight--;

      if (pkt->is_mtu_probe) {
        mtu_unprobeify_packet(pkt, stream);
      }

      pkt->fifo_gc = udx__fifo_push(&stream->retransmit_queue, pkt);
    }
  }

  int err = update_poll(stream->socket);
  return err < 0 ? err : 0;
}

int
udx_stream_change_remote (udx_stream_t *stream, udx_socket_t *socket, uint32_t remote_id, const struct sockaddr *remote_addr, udx_stream_remote_changed_cb on_remote_changed) {
  assert(stream->status & UDX_STREAM_CONNECTED);

  // the since the udx_t object stores streams_by_id, we cannot migrate streams across udx objects
  // the local id's of different udx streams may collide.
  assert(socket->udx == stream->socket->udx);
  if (!(stream->status & UDX_STREAM_CONNECTED)) {
    return UV_EINVAL;
  }

  if (remote_addr->sa_family == AF_INET) {
    stream->remote_addr_len = sizeof(struct sockaddr_in);
    if (((struct sockaddr_in *) remote_addr)->sin_port == 0) {
      return UV_EINVAL;
    }
  } else if (remote_addr->sa_family == AF_INET6) {
    stream->remote_addr_len = sizeof(struct sockaddr_in6);
    if (((struct sockaddr_in6 *) remote_addr)->sin6_port == 0) {
      return UV_EINVAL;
    }
  } else {
    return UV_EINVAL;
  }

  memcpy(&stream->remote_addr, remote_addr, stream->remote_addr_len);

  if (stream->socket->family == 6 && stream->remote_addr.ss_family == AF_INET) {
    addr_to_v6((struct sockaddr_in *) &stream->remote_addr);
    stream->remote_addr_len = sizeof(struct sockaddr_in6);
  }

  stream->remote_id = remote_id;

  stream->socket = socket;

  if (stream->seq != stream->remote_acked) {
    debug_printf("change_remote: id=%u RA=%u Seq=%u\n", stream->local_id, stream->remote_acked, stream->seq);
    stream->remote_changing = true;
    stream->seq_on_remote_changed = stream->seq;
    stream->on_remote_changed = on_remote_changed;
  } else {
    debug_printf("change_remote: id=%u RA=%u Seq=%u, acting now!\n", stream->local_id, stream->remote_acked, stream->seq);
    on_remote_changed(stream);
  }

  stream->mtu = UDX_MTU_BASE;
  stream->mtu_state = UDX_MTU_STATE_BASE;
  stream->mtu_probe_count = 0;
  stream->mtu_probe_size = UDX_MTU_BASE; // starts with first ack, counts as a confirmation of base
  stream->mtu_max = UDX_MTU_MAX;         // revised in connect()

  return update_poll(stream->socket);
}

int
udx_stream_connect (udx_stream_t *stream, udx_socket_t *socket, uint32_t remote_id, const struct sockaddr *remote_addr) {
  if (stream->status & UDX_STREAM_CONNECTED) {
    return UV_EISCONN;
  }

  stream->status |= UDX_STREAM_CONNECTED;

  stream->remote_id = remote_id;
  stream->socket = socket;

  if (remote_addr->sa_family == AF_INET) {
    stream->remote_addr_len = sizeof(struct sockaddr_in);
    if (((struct sockaddr_in *) remote_addr)->sin_port == 0) {
      return UV_EINVAL;
    }
  } else if (remote_addr->sa_family == AF_INET6) {
    stream->remote_addr_len = sizeof(struct sockaddr_in6);
    if (((struct sockaddr_in6 *) remote_addr)->sin6_port == 0) {
      return UV_EINVAL;
    }
  } else {
    return UV_EINVAL;
  }

  memcpy(&(stream->remote_addr), remote_addr, stream->remote_addr_len);

  if (socket->family == 6 && stream->remote_addr.ss_family == AF_INET) {
    addr_to_v6((struct sockaddr_in *) &(stream->remote_addr));
    stream->remote_addr_len = sizeof(struct sockaddr_in6);
  }

  int mtu = udx__get_link_mtu(remote_addr);

  if (mtu == -1 || mtu > UDX_MTU_MAX) {
    mtu = UDX_MTU_MAX;
  }

  stream->mtu_max = mtu;

  return update_poll(stream->socket);
}

int
udx_stream_relay_to (udx_stream_t *stream, udx_stream_t *destination) {
  if (stream->relayed || (destination->status & UDX_STREAM_CLOSED) != 0) return UV_EINVAL;

  stream->relayed = true;
  stream->relay_to = destination;

  udx__cirbuf_set(&(destination->relaying_streams), (udx_cirbuf_val_t *) stream);

  return 0;
}

int
udx_stream_send (udx_stream_send_t *req, udx_stream_t *stream, const uv_buf_t bufs[], unsigned int bufs_len, udx_stream_send_cb cb) {
  assert(bufs_len == 1);

  req->stream = stream;
  req->on_send = cb;

  udx_socket_t *socket = stream->socket;
  udx_packet_t *pkt = &(req->pkt);

  init_stream_packet(pkt, UDX_HEADER_MESSAGE, stream, &bufs[0], 1);

  pkt->status = UDX_PACKET_STATE_UNCOMMITTED;
  pkt->type = UDX_PACKET_TYPE_STREAM_SEND;
  pkt->ttl = 0;
  pkt->ctx = req;
  pkt->is_retransmit = 0;
  pkt->transmits = 0;

  pkt->fifo_gc = udx__fifo_push(&stream->unordered, pkt);

  return update_poll(socket);
}

int
udx_stream_write_resume (udx_stream_t *stream, udx_stream_drain_cb drain_cb) {
  stream->on_drain = drain_cb;
  return 0;
}

static void
_udx_stream_write (udx_stream_write_t *write, udx_stream_t *stream, const uv_buf_t bufs[], unsigned int bufs_len, udx_stream_ack_cb ack_cb, bool is_write_end) {
  assert(bufs_len > 0);

  // initialize write object

  write->size = 0;
  write->bytes_acked = 0;
  write->is_write_end = is_write_end;
  write->stream = stream;
  write->on_ack = ack_cb;

  // consider:
  // make `udx_stream_write` re-entrant, allowing write to be called again to add more buffers to the same request object

  // can't create the buffers in a block because it is hard to determine where to free them:
  // the write request object is owned by the user, we can't hook into it's destruction
  // the stream_t object could hold writes but they may grow indefinitely

  for (unsigned int i = 0; i < bufs_len; i++) {
    udx_stream_write_buf_t *wbuf = &write->wbuf[i];

    wbuf->buf = bufs[i];
    wbuf->bytes_inflight = 0;
    wbuf->bytes_acked = 0;
    wbuf->write = write;
    wbuf->is_write_end = false;

    write->size += bufs[i].len;
    stream->writes_queued_bytes += bufs[i].len;

    if (is_write_end && i == bufs_len - 1) {
      wbuf->is_write_end = true;
    }
    udx__fifo_push(&stream->write_queue, wbuf);
  }
}

int
udx_stream_write (udx_stream_write_t *req, udx_stream_t *stream, const uv_buf_t bufs[], unsigned int bufs_len, udx_stream_ack_cb ack_cb) {
  assert(bufs_len > 0);

  req->nwbufs = bufs_len;

  // if this is the first inflight packet, we should "restart" rto timer
  // todo: move this into _udx_stream_write ?
  if (stream->inflight == 0) {
    stream->rto_timeout = uv_now(stream->udx->loop) + stream->rto;
  }

  _udx_stream_write(req, stream, bufs, bufs_len, ack_cb, false);

  int err = update_poll(stream->socket);
  if (err < 0) return err;

  if (stream->writes_queued_bytes > UDX_HIGH_WATERMARK + cwnd_in_bytes(stream)) {
    stream->hit_high_watermark = true;
    return 0;
  }

  return 1;
}

int
udx_stream_write_end (udx_stream_write_t *req, udx_stream_t *stream, const uv_buf_t bufs[], unsigned int bufs_len, udx_stream_ack_cb ack_cb) {
  stream->status |= UDX_STREAM_ENDING;

  if (bufs_len > 0) {
    req->nwbufs = bufs_len;
    _udx_stream_write(req, stream, bufs, bufs_len, ack_cb, true);
  } else {
    req->nwbufs = 1;
    uv_buf_t buf = uv_buf_init("", 0);
    _udx_stream_write(req, stream, &buf, 1, ack_cb, true);
  }

  int err = update_poll(stream->socket);
  if (err < 0) return err;

  if (stream->writes_queued_bytes > UDX_HIGH_WATERMARK + cwnd_in_bytes(stream)) {
    stream->hit_high_watermark = true;
    return 0;
  }

  return 1;
}

int
udx_stream_destroy (udx_stream_t *stream) {

  if ((stream->status & UDX_STREAM_CONNECTED) == 0) {
    stream->status |= UDX_STREAM_DESTROYED;
    close_maybe(stream, 0);
    return 0;
  }

  stream->status |= UDX_STREAM_DESTROYING;

  if (stream->relayed) {
    stream->status |= UDX_STREAM_DESTROYED;
    close_maybe(stream, 0);
    return 0;
  }

  stream->write_wanted |= UDX_STREAM_WRITE_WANT_DESTROY;

  int err = update_poll(stream->socket);
  return err < 0 ? err : 1;
}

static void
on_uv_getaddrinfo (uv_getaddrinfo_t *req, int status, struct addrinfo *res) {
  udx_lookup_t *lookup = (udx_lookup_t *) req->data;

  if (status < 0) {
    lookup->on_lookup(lookup, status, NULL, 0);
  } else {
    lookup->on_lookup(lookup, status, res->ai_addr, res->ai_addrlen);
  }

  uv_freeaddrinfo(res);
}

int
udx_lookup (uv_loop_t *loop, udx_lookup_t *req, const char *host, unsigned int flags, udx_lookup_cb cb) {
  req->on_lookup = cb;
  req->req.data = req;

  memset(&req->hints, 0, sizeof(struct addrinfo));

  int family = AF_UNSPEC;

  if (flags & UDX_LOOKUP_FAMILY_IPV4) family = AF_INET;
  if (flags & UDX_LOOKUP_FAMILY_IPV6) family = AF_INET6;

  req->hints.ai_family = family;
  req->hints.ai_socktype = SOCK_STREAM;

  return uv_getaddrinfo(loop, &req->req, on_uv_getaddrinfo, host, NULL, &req->hints);
}

static int
cmp_interface (const void *a, const void *b) {
  const uv_interface_address_t *ia = a;
  const uv_interface_address_t *ib = b;

  int result;

  result = strcmp(ia->phys_addr, ib->phys_addr);
  if (result != 0) return result;

  result = memcmp(&ia->address, &ib->address, sizeof(ia->address));
  if (result != 0) return result;

  return 0;
}

static void
on_interface_event_interval (uv_timer_t *timer) {
  udx_interface_event_t *handle = (udx_interface_event_t *) timer->data;

  uv_interface_address_t *prev_addrs = handle->addrs;
  int prev_addrs_len = handle->addrs_len;
  bool prev_sorted = handle->sorted;

  int err = uv_interface_addresses(&(handle->addrs), &(handle->addrs_len));
  if (err < 0) {
    handle->on_event(handle, err);
    return;
  }

  handle->sorted = false;

  bool changed = handle->addrs_len != prev_addrs_len;

  for (int i = 0; !changed && i < handle->addrs_len; i++) {
    if (cmp_interface(&handle->addrs[i], &prev_addrs[i]) == 0) {
      continue;
    }

    if (handle->sorted) changed = true;
    else {
      qsort(handle->addrs, handle->addrs_len, sizeof(uv_interface_address_t), cmp_interface);

      if (!prev_sorted) {
        qsort(prev_addrs, prev_addrs_len, sizeof(uv_interface_address_t), cmp_interface);
      }

      handle->sorted = true;
      i = 0;
    }
  }

  if (changed) handle->on_event(handle, 0);
  else handle->sorted = prev_sorted;

  uv_free_interface_addresses(prev_addrs, prev_addrs_len);
}

static void
on_interface_event_close (uv_handle_t *handle) {
  udx_interface_event_t *event = (udx_interface_event_t *) handle->data;

  if (event->on_close != NULL) {
    event->on_close(event);
  }
}

int
udx_interface_event_init (uv_loop_t *loop, udx_interface_event_t *handle) {
  handle->loop = loop;
  handle->sorted = false;

  int err = uv_interface_addresses(&(handle->addrs), &(handle->addrs_len));
  if (err < 0) return err;

  err = uv_timer_init(handle->loop, &(handle->timer));
  if (err < 0) return err;

  handle->timer.data = handle;

  return 0;
}

int
udx_interface_event_start (udx_interface_event_t *handle, udx_interface_event_cb cb, uint64_t frequency) {
  handle->on_event = cb;

  int err = uv_timer_start(&(handle->timer), on_interface_event_interval, 0, frequency);
  return err < 0 ? err : 0;
}

int
udx_interface_event_stop (udx_interface_event_t *handle) {
  handle->on_event = NULL;

  int err = uv_timer_stop(&(handle->timer));
  return err < 0 ? err : 0;
}

int
udx_interface_event_close (udx_interface_event_t *handle, udx_interface_event_close_cb cb) {
  handle->on_event = NULL;
  handle->on_close = cb;

  uv_free_interface_addresses(handle->addrs, handle->addrs_len);

  int err = uv_timer_stop(&(handle->timer));
  if (err < 0) return err;

  uv_close((uv_handle_t *) &(handle->timer), on_interface_event_close);

  return 0;
}
