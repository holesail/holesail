#ifndef UDX_IO_H
#define UDX_IO_H

#include "../include/udx.h"

int
udx__get_link_mtu (const struct sockaddr *s);

ssize_t
udx__sendmsg (udx_socket_t *handle, const uv_buf_t bufs[], unsigned int bufs_len, struct sockaddr *addr, int addr_len);

ssize_t
udx__recvmsg (udx_socket_t *handle, uv_buf_t *buf, struct sockaddr *addr, int addr_len);

void
udx__on_writable (udx_socket_t *socket);

#endif // UDX_IO_H
