#ifndef UDX_H
#define UDX_H

#ifdef __cplusplus
extern "C" {
#endif

#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <uv.h>

#define UDX_HEADER_SIZE      20
#define UDX_IPV4_HEADER_SIZE (20 + 8 + UDX_HEADER_SIZE)
#define UDX_IPV6_HEADER_SIZE (40 + 8 + UDX_HEADER_SIZE)

// MTU constants TODO: move into udx.c or internal.h?
#define UDX_MTU_BASE       1200
#define UDX_MTU_MAX_PROBES 3
#define UDX_MTU_MAX        1500
#define UDX_MTU_STEP       32

#define UDX_MTU_STATE_BASE            1
#define UDX_MTU_STATE_SEARCH          2
#define UDX_MTU_STATE_ERROR           3
#define UDX_MTU_STATE_SEARCH_COMPLETE 4

#define UDX_CLOCK_GRANULARITY_MS 20

#define UDX_MAGIC_BYTE 255
#define UDX_VERSION    1

#define UDX_SOCKET_RECEIVING       0b0001
#define UDX_SOCKET_BOUND           0b0010
#define UDX_SOCKET_CLOSING         0b0100
#define UDX_SOCKET_CLOSING_HANDLES 0b1000

#define UDX_STREAM_CONNECTED        0b00000000001
#define UDX_STREAM_RECEIVING        0b00000000010
#define UDX_STREAM_READING          0b00000000100
#define UDX_STREAM_ENDING           0b00000001000
#define UDX_STREAM_ENDING_REMOTE    0b00000010000
#define UDX_STREAM_ENDED            0b00000100000
#define UDX_STREAM_ENDED_REMOTE     0b00001000000
#define UDX_STREAM_DESTROYING       0b00010000000
#define UDX_STREAM_DESTROYED        0b00100000000
#define UDX_STREAM_DESTROYED_REMOTE 0b01000000000
#define UDX_STREAM_CLOSED           0b10000000000

#define UDX_PACKET_STATE_UNCOMMITTED 0
#define UDX_PACKET_STATE_INFLIGHT    1
#define UDX_PACKET_STATE_RETRANSMIT  2

#define UDX_PACKET_TYPE_STREAM_RELAY   0b00000
#define UDX_PACKET_TYPE_STREAM_STATE   0b00001
#define UDX_PACKET_TYPE_STREAM_WRITE   0b00010
#define UDX_PACKET_TYPE_STREAM_SEND    0b00100
#define UDX_PACKET_TYPE_STREAM_DESTROY 0b01000
#define UDX_PACKET_TYPE_SOCKET_SEND    0b10000

#define UDX_HEADER_DATA    0b00001
#define UDX_HEADER_END     0b00010
#define UDX_HEADER_SACK    0b00100
#define UDX_HEADER_MESSAGE 0b01000
#define UDX_HEADER_DESTROY 0b10000

#define UDX_STREAM_WRITE_WANT_DATA    0b001
#define UDX_STREAM_WRITE_WANT_STATE   0b010
#define UDX_STREAM_WRITE_WANT_DESTROY 0b100

typedef struct {
  uint32_t seq;
} udx_cirbuf_val_t;

typedef struct {
  uint32_t size;
  uint32_t mask;
  udx_cirbuf_val_t **values;
} udx_cirbuf_t;

typedef struct {
  uint32_t btm;
  uint32_t len;
  uint32_t max_len;
  uint32_t mask;
  void **values;
} udx_fifo_t;

typedef struct udx_s udx_t;
typedef struct udx_socket_s udx_socket_t;
typedef struct udx_stream_s udx_stream_t;
typedef struct udx_packet_s udx_packet_t;

typedef struct udx_socket_send_s udx_socket_send_t;
typedef struct udx_stream_send_s udx_stream_send_t;
typedef struct udx_stream_write_s udx_stream_write_t;
typedef struct udx_stream_write_buf_s udx_stream_write_buf_t;

typedef enum {
  UDX_LOOKUP_FAMILY_IPV4 = 1,
  UDX_LOOKUP_FAMILY_IPV6 = 2,
} udx_lookup_flags;

typedef struct udx_lookup_s udx_lookup_t;

typedef struct udx_interface_event_s udx_interface_event_t;

typedef void (*udx_socket_send_cb)(udx_socket_send_t *req, int status);
typedef void (*udx_socket_recv_cb)(udx_socket_t *socket, ssize_t read_len, const uv_buf_t *buf, const struct sockaddr *from);
typedef void (*udx_socket_close_cb)(udx_socket_t *socket);

typedef int (*udx_stream_firewall_cb)(udx_stream_t *stream, udx_socket_t *socket, const struct sockaddr *from);
typedef void (*udx_stream_read_cb)(udx_stream_t *stream, ssize_t read_len, const uv_buf_t *buf);
typedef void (*udx_stream_drain_cb)(udx_stream_t *stream);
typedef void (*udx_stream_remote_changed_cb)(udx_stream_t *stream);
typedef void (*udx_stream_ack_cb)(udx_stream_write_t *req, int status, int unordered);
typedef void (*udx_stream_send_cb)(udx_stream_send_t *req, int status);
typedef void (*udx_stream_recv_cb)(udx_stream_t *stream, ssize_t read_len, const uv_buf_t *buf);
typedef void (*udx_stream_close_cb)(udx_stream_t *stream, int status);

typedef void (*udx_lookup_cb)(udx_lookup_t *handle, int status, const struct sockaddr *addr, int addr_len);

typedef void (*udx_interface_event_cb)(udx_interface_event_t *handle, int status);
typedef void (*udx_interface_event_close_cb)(udx_interface_event_t *handle);

struct udx_s {
  uv_timer_t timer;
  uv_loop_t *loop;

  uint32_t refs;
  uint32_t sockets;
  udx_socket_t *timer_closed_by;

  uint32_t streams_len;
  uint32_t streams_max_len;
  udx_stream_t **streams;

  udx_cirbuf_t streams_by_id;
};

struct udx_socket_s {
  uv_udp_t handle;
  uv_poll_t io_poll;

  udx_fifo_t send_queue;

  udx_t *udx;
  udx_cirbuf_t *streams_by_id; // for convenience

  int family;
  int status;
  int readers;
  int events;
  int ttl;
  int pending_closes;

  void *data;

  udx_socket_recv_cb on_recv;
  udx_socket_close_cb on_close;
};

typedef struct udx_cong_s {
  uint32_t K;
  uint32_t ack_cnt;
  uint32_t origin_point;
  uint32_t delay_min;
  uint32_t cnt;
  uint64_t last_time;
  uint64_t start_time;
  uint32_t last_max_cwnd;
  uint32_t last_cwnd;
  uint32_t tcp_cwnd;
} udx_cong_t;

struct udx_stream_s {
  uint32_t local_id; // must be first entry, so its compat with the cirbuf
  uint32_t remote_id;

  int set_id;
  int status;
  int write_wanted;
  int out_of_order;
  int recovery; // number of packets to send before recovery finished
  int deferred_ack;

  bool hit_high_watermark;
  size_t writes_queued_bytes;

  bool reordering_seen;
  int retransmitting;

  udx_t *udx;
  udx_socket_t *socket;

  bool relayed;
  udx_stream_t *relay_to;
  udx_cirbuf_t relaying_streams;

  struct sockaddr_storage remote_addr;
  int remote_addr_len;

  bool remote_changing;
  uint32_t seq_on_remote_changed;
  udx_stream_remote_changed_cb on_remote_changed;

  void *data;

  udx_stream_firewall_cb on_firewall;
  udx_stream_read_cb on_read;
  udx_stream_recv_cb on_recv;
  udx_stream_drain_cb on_drain;
  udx_stream_close_cb on_close;

  // mtu. RFC8899 5.1.1 and 5.1.3
  int mtu_state; // MTU_STATE_*
  bool mtu_probe_wanted;
  int mtu_probe_count;
  int mtu_probe_size; // size of the outstanding probe
  int mtu_max;        // min(UDX_MTU_MAX, get_link_mtu(remote_addr))
  uint16_t mtu;

  uint32_t seq;
  uint32_t ack;
  uint32_t remote_acked;
  uint32_t remote_ended;

  uint32_t srtt;
  uint32_t rttvar;
  uint32_t rto;

  // rack data...
  uint32_t rack_rtt_min;
  uint32_t rack_rtt;
  uint64_t rack_time_sent;
  uint32_t rack_next_seq;
  uint32_t rack_fack;

  uint32_t pkts_inflight; // packets inflight to the other peer
  uint32_t pkts_buffered; // how many (data) packets received but not processed (out of order)?

  // timestamps...
  uint64_t rto_timeout;
  uint64_t rack_timeout;

  size_t inflight;

  uint32_t sacks;
  uint32_t ssthresh;
  uint32_t cwnd;
  uint32_t cwnd_cnt;
  uint32_t rwnd;

  // congestion state
  udx_cong_t cong;

  udx_fifo_t write_queue; // udx_stream_write_t
  udx_cirbuf_t outgoing;
  udx_cirbuf_t incoming;

  udx_fifo_t retransmit_queue; // udx_packet_t

  udx_fifo_t unordered;
};

struct udx_packet_s {
  uint32_t seq; // must be the first entry, so its compat with the cirbuf

  int status;
  int type;
  int ttl;
  int is_retransmit;

  uint8_t transmits;
  bool is_mtu_probe;
  uint16_t size;
  uint64_t time_sent;

  void *ctx; // stream_send_t | socket_send_t | stream_t

  struct sockaddr_storage dest;
  int dest_len;

  uint32_t fifo_gc; // for removing from inflight / retransmit queue

  // just alloc it in place here, easier to manage
  char header[UDX_HEADER_SIZE];
  unsigned short nbufs;

  // inefficient - only relevant for stream_t packets
  unsigned short nwbufs;
  udx_stream_write_buf_t **wbufs;
};

struct udx_socket_send_s {
  udx_packet_t pkt;
  uv_buf_t bufs[1]; // buf_t[] must be after packet_t
  udx_socket_t *socket;

  udx_socket_send_cb on_send;

  void *data;
};

struct udx_stream_write_buf_s {
  // immutable original buf
  uv_buf_t buf;

  // 1. remove from write_queue when bytes_inflight + bytes_acked == buf.len
  // 2. free when bytes_acked == buf.len
  size_t bytes_inflight;
  size_t bytes_acked;

  udx_stream_write_t *write;

  bool is_write_end;
};

struct udx_stream_write_s {
  size_t size;
  size_t bytes_acked;
  bool is_write_end;

  udx_stream_t *stream;
  udx_stream_ack_cb on_ack;

  void *data;

  unsigned int nwbufs;
  udx_stream_write_buf_t wbuf[];
};

struct udx_stream_send_s {
  udx_packet_t pkt;
  uv_buf_t bufs[3]; // buf_t[] must be after packet_t
  udx_stream_t *stream;

  udx_stream_send_cb on_send;

  void *data;
};

struct udx_lookup_s {
  uv_getaddrinfo_t req;
  struct addrinfo hints;

  udx_lookup_cb on_lookup;

  void *data;
};

struct udx_interface_event_s {
  uv_timer_t timer;
  uv_loop_t *loop;

  uv_interface_address_t *addrs;
  int addrs_len;
  bool sorted;

  udx_interface_event_cb on_event;
  udx_interface_event_close_cb on_close;

  void *data;
};

int
udx_init (uv_loop_t *loop, udx_t *udx);

int
udx_socket_init (udx_t *udx, udx_socket_t *socket);

int
udx_socket_get_send_buffer_size (udx_socket_t *socket, int *value);

int
udx_socket_set_send_buffer_size (udx_socket_t *socket, int value);

int
udx_socket_get_recv_buffer_size (udx_socket_t *socket, int *value);

int
udx_socket_set_recv_buffer_size (udx_socket_t *socket, int value);

int
udx_socket_get_ttl (udx_socket_t *socket, int *ttl);

int
udx_socket_set_ttl (udx_socket_t *socket, int ttl);

int
udx_socket_bind (udx_socket_t *socket, const struct sockaddr *addr, unsigned int flags);

int
udx_socket_getsockname (udx_socket_t *socket, struct sockaddr *name, int *name_len);

int
udx_socket_send (udx_socket_send_t *req, udx_socket_t *socket, const uv_buf_t bufs[], unsigned int bufs_len, const struct sockaddr *addr, udx_socket_send_cb cb);

int
udx_socket_send_ttl (udx_socket_send_t *req, udx_socket_t *socket, const uv_buf_t bufs[], unsigned int bufs_len, const struct sockaddr *addr, int ttl, udx_socket_send_cb cb);

int
udx_socket_recv_start (udx_socket_t *socket, udx_socket_recv_cb cb);

int
udx_socket_recv_stop (udx_socket_t *socket);

int
udx_socket_close (udx_socket_t *socket, udx_socket_close_cb cb);

// only exposed here as a convenience / debug tool - the udx instance uses this automatically
int
udx_check_timeouts (udx_t *udx);

int
udx_stream_init (udx_t *udx, udx_stream_t *stream, uint32_t local_id, udx_stream_close_cb close_cb);

int
udx_stream_get_mtu (udx_stream_t *stream, uint16_t *mtu);

int
udx_stream_get_seq (udx_stream_t *stream, uint32_t *seq);

int
udx_stream_set_seq (udx_stream_t *stream, uint32_t seq);

int
udx_stream_get_ack (udx_stream_t *stream, uint32_t *ack);

int
udx_stream_set_ack (udx_stream_t *stream, uint32_t ack);

int
udx_stream_connect (udx_stream_t *stream, udx_socket_t *socket, uint32_t remote_id, const struct sockaddr *remote_addr);

int
udx_stream_change_remote (udx_stream_t *stream, udx_socket_t *socket, uint32_t remote_id, const struct sockaddr *remote_addr, udx_stream_remote_changed_cb remote_changed_cb);

int
udx_stream_relay_to (udx_stream_t *stream, udx_stream_t *destination);

int
udx_stream_firewall (udx_stream_t *stream, udx_stream_firewall_cb firewall_cb);

int
udx_stream_recv_start (udx_stream_t *stream, udx_stream_recv_cb cb);

int
udx_stream_recv_stop (udx_stream_t *stream);

int
udx_stream_read_start (udx_stream_t *stream, udx_stream_read_cb cb);

int
udx_stream_read_stop (udx_stream_t *stream);

// only exposed here as a convenience / debug tool - the udx instance uses this automatically
int
udx_stream_check_timeouts (udx_stream_t *stream);

int
udx_stream_send (udx_stream_send_t *req, udx_stream_t *stream, const uv_buf_t bufs[], unsigned int bufs_len, udx_stream_send_cb cb);

int
udx_stream_write_resume (udx_stream_t *stream, udx_stream_drain_cb drain_cb);

int
udx_stream_write_sizeof (int nwbufs);

int
udx_stream_write (udx_stream_write_t *req, udx_stream_t *stream, const uv_buf_t bufs[], unsigned int bufs_len, udx_stream_ack_cb ack_cb);

int
udx_stream_write_end (udx_stream_write_t *req, udx_stream_t *stream, const uv_buf_t bufs[], unsigned int bufs_len, udx_stream_ack_cb ack_cb);

int
udx_stream_destroy (udx_stream_t *stream);

int
udx_lookup (uv_loop_t *loop, udx_lookup_t *req, const char *host, unsigned int flags, udx_lookup_cb cb);

int
udx_interface_event_init (uv_loop_t *loop, udx_interface_event_t *handle);

int
udx_interface_event_start (udx_interface_event_t *handle, udx_interface_event_cb cb, uint64_t frequency);

int
udx_interface_event_stop (udx_interface_event_t *handle);

int
udx_interface_event_close (udx_interface_event_t *handle, udx_interface_event_close_cb cb);

#ifdef __cplusplus
}
#endif
#endif // UDX_H
