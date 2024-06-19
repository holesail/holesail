#ifndef UDX_DEBUG_H
#define UDX_DEBUG_H

#ifndef NDEBUG
#define DEBUG 1
#else
#define DEBUG 0
#endif

#ifdef DEBUG_STATS
#include "../include/udx.h"
#include <uv.h>

static uint64_t debug_start = 0;

static void
debug_print_cwnd_stats (udx_stream_t *stream) {
  if (!debug_start) debug_start = uv_hrtime() / 1000000;
  printf("%llu %u %u %u\n", (uv_hrtime() / 1000000) - debug_start, stream->cwnd, stream->cwnd_cnt, stream->srtt);
}
#else
static void
debug_print_cwnd_stats (udx_stream_t *stream) {
  (void) stream; // silence 'unused-parameter' warning
}
#endif

#define debug_printf(...) \
  do { \
    if (DEBUG) fprintf(stderr, __VA_ARGS__); \
  } while (0)

static void
debug_print_outgoing (udx_stream_t *stream) {
  if (DEBUG) {
    for (uint32_t s = stream->remote_acked; s < stream->seq; s++) {
      udx_packet_t *pkt = (udx_packet_t *) udx__cirbuf_get(&stream->outgoing, s);
      if (pkt == NULL) {
        debug_printf("-");
        continue;
      }

      if (pkt->status == UDX_PACKET_STATE_INFLIGHT) {
        debug_printf("I");
        continue;
      }
      if (pkt->status == UDX_PACKET_STATE_RETRANSMIT) {
        debug_printf("R");
        continue;
      }
      assert(false && "should only be inflight or retransmitting");
    }
    debug_printf("\n");
  }
}

#endif // UDX_DEBUG_H
