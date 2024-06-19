#include <assert.h>
#include <uv.h>

#include "fifo.h"
#include "internal.h"
#include "io.h"

int
udx__get_link_mtu (const struct sockaddr *addr) {
  assert(addr->sa_family == AF_INET || addr->sa_family == AF_INET6);

  int s = socket(addr->sa_family, SOCK_DGRAM, 0);
  if (s == -1) {
    return -1;
  }

  int rc = connect(s, addr, addr->sa_family == AF_INET ? sizeof(struct sockaddr_in) : sizeof(struct sockaddr_in6));

  if (rc == -1) {
    return -1;
  }

  int mtu;
  int mtu_opt_size = sizeof mtu;

  if (addr->sa_family == AF_INET) {
    rc = getsockopt(s, IPPROTO_IP, IP_MTU, (char *) &mtu, &mtu_opt_size);
  } else {
    rc = getsockopt(s, IPPROTO_IPV6, IPV6_MTU, (char *) &mtu, &mtu_opt_size);
  }
  if (rc == -1) {
    close(s);
    return -1;
  }

  closesocket(s);
  return mtu;
}

ssize_t
udx__sendmsg (udx_socket_t *socket, const uv_buf_t bufs[], unsigned int bufs_len, struct sockaddr *addr, int addr_len) {
  DWORD bytes, flags = 0;

  int result = WSASendTo(
    socket->handle.socket,
    (WSABUF *) bufs,
    bufs_len,
    &bytes,
    flags,
    addr,
    addr_len,
    NULL,
    NULL
  );

  if (result != 0) {
    return uv_translate_sys_error(WSAGetLastError());
  }

  return bytes;
}

ssize_t
udx__recvmsg (udx_socket_t *socket, uv_buf_t *buf, struct sockaddr *addr, int addr_len) {
  DWORD bytes, flags = 0;

  int result = WSARecvFrom(
    socket->handle.socket,
    (WSABUF *) buf,
    1,
    &bytes,
    &flags,
    addr,
    &addr_len,
    NULL,
    NULL
  );

  if (result != 0) {
    return uv_translate_sys_error(WSAGetLastError());
  }

  return bytes;
}

void
udx__on_writable (udx_socket_t *socket) {
  assert((socket->status & UDX_SOCKET_CLOSING_HANDLES) == 0);
  while (true) {
    udx_packet_t *pkt = udx__shift_packet(socket);
    if (pkt == NULL) break;

    bool adjust_ttl = pkt->ttl > 0 && socket->ttl != pkt->ttl;

    if (adjust_ttl) uv_udp_set_ttl((uv_udp_t *) socket, pkt->ttl);

    if (socket->family == 6 && pkt->dest.ss_family == AF_INET) {
      addr_to_v6((struct sockaddr_in *) &(pkt->dest));
      pkt->dest_len = sizeof(struct sockaddr_in6);
    }

    ssize_t size = udx__sendmsg(socket, (uv_buf_t *) (pkt + 1), pkt->nbufs, (struct sockaddr *) &(pkt->dest), pkt->dest_len);

    if (adjust_ttl) uv_udp_set_ttl((uv_udp_t *) socket, socket->ttl);

    if (size == UV_EAGAIN) {
      udx__unshift_packet(pkt, socket);
      break;
    }
    pkt->time_sent = uv_now(socket->udx->loop);
    udx__confirm_packet(pkt);
    if (socket->status & UDX_SOCKET_CLOSING_HANDLES) {
      break;
    }
  }
}
