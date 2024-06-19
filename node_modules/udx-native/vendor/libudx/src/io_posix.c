#define _GNU_SOURCE

#if defined(__linux__) || defined(__FreeBSD__)
#define UDX_PLATFORM_HAS_SENDMMSG
#endif

#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>
#include <uv.h>

#include "../include/udx.h"
#include "fifo.h"
#include "internal.h"
#include "io.h"

#if defined(__APPLE__)

int
udx__get_link_mtu (const struct sockaddr *addr) {
  return -1;
}

#else

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
  socklen_t mtu_opt_size = sizeof mtu;
  if (addr->sa_family == AF_INET) {
    rc = getsockopt(s, IPPROTO_IP, IP_MTU, &mtu, &mtu_opt_size);
  } else {
    rc = getsockopt(s, IPPROTO_IPV6, IPV6_MTU, &mtu, &mtu_opt_size);
  }
  if (rc == -1) {
    close(s);
    return -1;
  }

  close(s);
  return mtu;
}
#endif

ssize_t
udx__sendmsg (udx_socket_t *handle, const uv_buf_t bufs[], unsigned int bufs_len, struct sockaddr *addr, int addr_len) {
  ssize_t size;
  struct msghdr h;

  memset(&h, 0, sizeof(h));

  h.msg_name = addr;
  h.msg_namelen = addr_len;

  h.msg_iov = (struct iovec *) bufs;
  h.msg_iovlen = bufs_len;

  do {
    size = sendmsg(handle->io_poll.io_watcher.fd, &h, 0);
  } while (size == -1 && errno == EINTR);

  return size == -1 ? uv_translate_sys_error(errno) : size;
}

ssize_t
udx__recvmsg (udx_socket_t *handle, uv_buf_t *buf, struct sockaddr *addr, int addr_len) {
  ssize_t size;
  struct msghdr h;

  memset(&h, 0, sizeof(h));

  h.msg_name = addr;
  h.msg_namelen = addr_len;

  h.msg_iov = (struct iovec *) buf;
  h.msg_iovlen = 1;

  do {
    size = recvmsg(handle->io_poll.io_watcher.fd, &h, 0);
  } while (size == -1 && errno == EINTR);

  return size == -1 ? uv_translate_sys_error(errno) : size;
}

#define UDX_SENDMMSG_BATCH_SIZE 20

void
udx__on_writable (udx_socket_t *socket) {
#ifdef UDX_PLATFORM_HAS_SENDMMSG
  bool finished = false;

  assert((socket->status & UDX_SOCKET_CLOSING_HANDLES) == 0);

  while (!finished) {
    udx_packet_t *batch[UDX_SENDMMSG_BATCH_SIZE];
    struct mmsghdr h[UDX_SENDMMSG_BATCH_SIZE];

    int npkts = 0;

    int ttl = -1;
    bool adjust_ttl = false;

    while (npkts < UDX_SENDMMSG_BATCH_SIZE) {
      udx_packet_t *pkt = udx__shift_packet(socket);

      if (pkt == NULL) {
        finished = true;
        break;
      }

      if (ttl == -1) {
        ttl = pkt->ttl;
        adjust_ttl = ttl > 0 && socket->ttl != ttl;
      }

      if (pkt->ttl != ttl) {
        udx__unshift_packet(pkt, socket);
        break;
      }

      if (socket->family == 6 && pkt->dest.ss_family == AF_INET) {
        addr_to_v6((struct sockaddr_in *) &(pkt->dest));
        pkt->dest_len = sizeof(struct sockaddr_in6);
      }

      batch[npkts] = pkt;
      struct mmsghdr *p = &h[npkts];
      memset(p, 0, sizeof(*p));
      p->msg_hdr.msg_name = &pkt->dest;
      p->msg_hdr.msg_namelen = pkt->dest_len;

      p->msg_hdr.msg_iov = (struct iovec *) (pkt + 1);
      p->msg_hdr.msg_iovlen = pkt->nbufs;

      npkts++;
    }

    int rc;

    if (adjust_ttl) uv_udp_set_ttl((uv_udp_t *) socket, ttl);

    do {
      rc = sendmmsg(socket->io_poll.io_watcher.fd, h, npkts, 0);
    } while (rc == -1 && errno == EINTR);

    if (adjust_ttl) uv_udp_set_ttl((uv_udp_t *) socket, socket->ttl);

    rc = rc == -1 ? uv_translate_sys_error(errno) : rc;

    int nsent = rc > 0 ? rc : 0;

    if (rc < 0 && rc != UV_EAGAIN) {
      nsent = npkts; // something errored badly, assume all packets sent and lost
    }

    int unsent = npkts - nsent;

    // cancel packets in reverse !
    for (int i = npkts; i > npkts - unsent; i--) {
      udx__unshift_packet(batch[i - 1], socket);
    }

    for (int i = 0; i < nsent; i++) {
      udx_packet_t *pkt = batch[i];
      // todo: set in confirm packet with uv_now()
      pkt->time_sent = uv_now(socket->udx->loop);
      udx__confirm_packet(batch[i]);
    }

    if (rc == UV_EAGAIN || socket->status & UDX_SOCKET_CLOSING_HANDLES) {
      finished = true;
    }
  }
#else /* no sendmmsg */
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
    // todo: set in confirm packet with uv_now()
    pkt->time_sent = uv_now(socket->udx->loop);
    udx__confirm_packet(pkt);
    if (socket->status & UDX_SOCKET_CLOSING_HANDLES) {
      break;
    }
  }
#endif
}
