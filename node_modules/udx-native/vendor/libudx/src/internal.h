#ifndef UDX_INTERNAL_H
#define UDX_INTERNAL_H

#include "../include/udx.h"

#define UDX_PACKET_CALLBACK     (UDX_PACKET_TYPE_STREAM_SEND | UDX_PACKET_TYPE_STREAM_DESTROY | UDX_PACKET_TYPE_SOCKET_SEND)
#define UDX_PACKET_FREE_ON_SEND (UDX_PACKET_TYPE_STREAM_STATE | UDX_PACKET_TYPE_STREAM_DESTROY | UDX_PACKET_TYPE_STREAM_RELAY)

#define UDX_UNUSED(x) ((void) (x))

static inline void
addr_to_v6 (struct sockaddr_in *addr) {
  struct sockaddr_in6 in;
  memset(&in, 0, sizeof(in));

  in.sin6_family = AF_INET6;
  in.sin6_port = addr->sin_port;
#ifdef SIN6_LEN
  in.sin6_len = sizeof(struct sockaddr_in6);
#endif

  in.sin6_addr.s6_addr[10] = 0xff;
  in.sin6_addr.s6_addr[11] = 0xff;

  // Copy the IPv4 address to the last 4 bytes of the IPv6 address.
  memcpy(&(in.sin6_addr.s6_addr[12]), &(addr->sin_addr), 4);

  memcpy(addr, &in, sizeof(in));
}

void
udx__ensure_latest_stream_ack (udx_packet_t *packet);

void
udx__trigger_send_callback (udx_packet_t *packet);
void
udx__close_handles (udx_socket_t *socket);

udx_packet_t *
udx__shift_packet (udx_socket_t *socket);
void
udx__confirm_packet (udx_packet_t *pkt);
void
udx__unshift_packet (udx_packet_t *pkt, udx_socket_t *socket);

#endif // UDX_INTERNAL_H
