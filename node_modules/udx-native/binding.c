#include <napi-macros.h>
#include <node_api.h>
#include <stdlib.h>
#include <string.h>
#include <udx.h>
#include <uv.h>

#define UDX_NAPI_THROW(err) \
  { \
    napi_throw_error(env, uv_err_name(err), uv_strerror(err)); \
    return NULL; \
  }

#define UDX_NAPI_INTERACTIVE     0
#define UDX_NAPI_NON_INTERACTIVE 1
#define UDX_NAPI_FRAMED          2

#define UDX_NAPI_CALLBACK(self, fn, src) \
  napi_env env = self->env; \
  napi_handle_scope scope; \
  napi_open_handle_scope(env, &scope); \
  napi_value ctx; \
  napi_get_reference_value(env, self->ctx, &ctx); \
  napi_value callback; \
  napi_get_reference_value(env, fn, &callback); \
  src \
    napi_close_handle_scope(env, scope);

#define UDX_NAPI_MAKE_DATA_ALLOC_CALLBACK(self, env, nil, ctx, cb, n, argv, res) \
  if (napi_make_callback(env, nil, ctx, cb, n, argv, res) == napi_pending_exception) { \
    napi_value fatal_exception; \
    napi_get_and_clear_last_exception(env, &fatal_exception); \
    napi_fatal_exception(env, fatal_exception); \
    { \
      UDX_NAPI_CALLBACK(self, self->realloc_data, { \
        NAPI_MAKE_CALLBACK(env, nil, ctx, callback, 0, NULL, res); \
        UDX_NAPI_SET_READ_BUFFER(self, res); \
        self->read_buf_head = self->read_buf; \
      }) \
    } \
  } else { \
    UDX_NAPI_SET_READ_BUFFER(self, res); \
    self->read_buf_head = self->read_buf; \
  }

#define UDX_NAPI_MAKE_MESSAGE_ALLOC_CALLBACK(self, env, nil, ctx, cb, n, argv, res) \
  if (napi_make_callback(env, nil, ctx, cb, n, argv, res) == napi_pending_exception) { \
    napi_value fatal_exception; \
    napi_get_and_clear_last_exception(env, &fatal_exception); \
    napi_fatal_exception(env, fatal_exception); \
    { \
      UDX_NAPI_CALLBACK(self, self->realloc_message, { \
        NAPI_MAKE_CALLBACK(env, nil, ctx, callback, 0, NULL, res); \
        UDX_NAPI_SET_READ_BUFFER(self->udx, res); \
      }) \
    } \
  } else { \
    UDX_NAPI_SET_READ_BUFFER(self->udx, res); \
  }

#define UDX_NAPI_SET_READ_BUFFER(self, res) \
  napi_get_buffer_info(env, *res, (void **) &(self->read_buf), &(self->read_buf_free));

typedef struct {
  udx_t udx;

  char *read_buf;
  size_t read_buf_free;
} udx_napi_t;

typedef struct {
  udx_socket_t socket;
  udx_napi_t *udx;

  napi_env env;
  napi_ref ctx;
  napi_ref on_send;
  napi_ref on_message;
  napi_ref on_close;
  napi_ref realloc_message;
} udx_napi_socket_t;

typedef struct {
  udx_stream_t stream;
  udx_napi_t *udx;

  int mode;

  char *read_buf;
  char *read_buf_head;
  size_t read_buf_free;

  ssize_t frame_len;

  napi_env env;
  napi_ref ctx;
  napi_ref on_data;
  napi_ref on_end;
  napi_ref on_drain;
  napi_ref on_ack;
  napi_ref on_send;
  napi_ref on_message;
  napi_ref on_close;
  napi_ref on_firewall;
  napi_ref on_remote_changed;
  napi_ref realloc_data;
  napi_ref realloc_message;
} udx_napi_stream_t;

typedef struct {
  udx_lookup_t handle;

  char *host;

  napi_env env;
  napi_ref ctx;
  napi_ref on_lookup;
} udx_napi_lookup_t;

typedef struct {
  udx_interface_event_t handle;

  napi_env env;
  napi_ref ctx;
  napi_ref on_event;
  napi_ref on_close;
} udx_napi_interface_event_t;

inline static void
parse_address (struct sockaddr *name, char *ip, size_t size, int *port, int *family) {
  if (name->sa_family == AF_INET) {
    *port = ntohs(((struct sockaddr_in *) name)->sin_port);
    *family = 4;
    uv_ip4_name((struct sockaddr_in *) name, ip, size);
  } else if (name->sa_family == AF_INET6) {
    *port = ntohs(((struct sockaddr_in6 *) name)->sin6_port);
    *family = 6;
    uv_ip6_name((struct sockaddr_in6 *) name, ip, size);
  }
}

static void
on_udx_send (udx_socket_send_t *req, int status) {
  udx_napi_socket_t *n = (udx_napi_socket_t *) req->socket;

  UDX_NAPI_CALLBACK(n, n->on_send, {
    napi_value argv[2];
    napi_create_int32(env, (uintptr_t) req->data, &(argv[0]));
    napi_create_int32(env, status, &(argv[1]));
    NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 2, argv, NULL)
  })
}

static void
on_udx_message (udx_socket_t *self, ssize_t read_len, const uv_buf_t *buf, const struct sockaddr *from) {
  udx_napi_socket_t *n = (udx_napi_socket_t *) self;

  int port = 0;
  char ip[INET6_ADDRSTRLEN];
  int family = 0;
  parse_address((struct sockaddr *) from, ip, INET6_ADDRSTRLEN, &port, &family);

  if (buf->len > n->udx->read_buf_free) return;

  memcpy(n->udx->read_buf, buf->base, buf->len);

  UDX_NAPI_CALLBACK(n, n->on_message, {
    napi_value argv[4];
    napi_create_uint32(env, read_len, &(argv[0]));
    napi_create_uint32(env, port, &(argv[1]));
    napi_create_string_utf8(env, ip, NAPI_AUTO_LENGTH, &(argv[2]));
    napi_create_uint32(env, family, &(argv[3]));

    napi_value res;
    UDX_NAPI_MAKE_MESSAGE_ALLOC_CALLBACK(n, env, NULL, ctx, callback, 4, argv, &res);
  })
}

static void
on_udx_close (udx_socket_t *self) {
  udx_napi_socket_t *n = (udx_napi_socket_t *) self;

  UDX_NAPI_CALLBACK(n, n->on_close, {NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 0, NULL, NULL)})

  napi_delete_reference(env, n->on_send);
  napi_delete_reference(env, n->on_message);
  napi_delete_reference(env, n->on_close);
  napi_delete_reference(env, n->realloc_message);
  napi_delete_reference(env, n->ctx);
}

static void
on_udx_stream_end (udx_stream_t *stream) {
  udx_napi_stream_t *n = (udx_napi_stream_t *) stream;

  size_t read = n->read_buf_head - n->read_buf;

  UDX_NAPI_CALLBACK(n, n->on_end, {
    napi_value argv[1];
    napi_create_uint32(env, read, &(argv[0]));
    NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 1, argv, NULL)
  })
}

static void
on_udx_stream_read (udx_stream_t *stream, ssize_t read_len, const uv_buf_t *buf) {
  if (read_len == UV_EOF) return on_udx_stream_end(stream);

  udx_napi_stream_t *n = (udx_napi_stream_t *) stream;

  // ignore the message if it doesn't fit in the read buffer
  if (buf->len > n->read_buf_free) return;

  if (n->mode == UDX_NAPI_FRAMED && n->frame_len == -1) {
    if (buf->len < 3) {
      n->mode = UDX_NAPI_INTERACTIVE;
    } else {
      uint8_t *b = (uint8_t *) buf->base;
      n->frame_len = 3 + (b[0] | (b[1] << 8) | (b[2] << 16));
    }
  }

  memcpy(n->read_buf_head, buf->base, buf->len);

  n->read_buf_head += buf->len;
  n->read_buf_free -= buf->len;

  if (n->mode == UDX_NAPI_NON_INTERACTIVE && n->read_buf_free >= 2 * stream->mtu) {
    return;
  }

  ssize_t read = n->read_buf_head - n->read_buf;

  if (n->mode == UDX_NAPI_FRAMED) {
    if (n->frame_len < read) {
      n->mode = UDX_NAPI_INTERACTIVE;
    } else if (n->frame_len == read) {
      n->frame_len = -1;
    } else if (n->read_buf_free < 2 * stream->mtu) {
      n->frame_len -= read;
    } else {
      return; // wait for more data
    }
  }

  UDX_NAPI_CALLBACK(n, n->on_data, {
    napi_value argv[1];
    napi_create_uint32(env, read, &(argv[0]));

    napi_value res;
    UDX_NAPI_MAKE_DATA_ALLOC_CALLBACK(n, env, NULL, ctx, callback, 1, argv, &res);
  })
}

static void
on_udx_stream_drain (udx_stream_t *stream) {
  udx_napi_stream_t *n = (udx_napi_stream_t *) stream;

  UDX_NAPI_CALLBACK(n, n->on_drain, {NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 0, NULL, NULL)})
}

static void
on_udx_stream_ack (udx_stream_write_t *req, int status, int unordered) {
  udx_napi_stream_t *n = (udx_napi_stream_t *) req->stream;

  UDX_NAPI_CALLBACK(n, n->on_ack, {
    napi_value argv[1];
    napi_create_uint32(env, (uintptr_t) req->data, &(argv[0]));
    NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 1, argv, NULL)
  })
}

static void
on_udx_stream_send (udx_stream_send_t *req, int status) {
  udx_napi_stream_t *n = (udx_napi_stream_t *) req->stream;

  UDX_NAPI_CALLBACK(n, n->on_send, {
    napi_value argv[2];
    napi_create_int32(env, (uintptr_t) req->data, &(argv[0]));
    napi_create_int32(env, status, &(argv[1]));
    NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 2, argv, NULL)
  })
}

static void
on_udx_stream_recv (udx_stream_t *stream, ssize_t read_len, const uv_buf_t *buf) {
  udx_napi_stream_t *n = (udx_napi_stream_t *) stream;

  if (buf->len > n->udx->read_buf_free) return;

  memcpy(n->udx->read_buf, buf->base, buf->len);

  UDX_NAPI_CALLBACK(n, n->on_message, {
    napi_value argv[1];
    napi_create_uint32(env, read_len, &(argv[0]));

    napi_value res;
    UDX_NAPI_MAKE_MESSAGE_ALLOC_CALLBACK(n, env, NULL, ctx, callback, 1, argv, &res);
  })
}

static void
on_udx_stream_close (udx_stream_t *stream, int status) {
  udx_napi_stream_t *n = (udx_napi_stream_t *) stream;

  if (status >= 0) {
    UDX_NAPI_CALLBACK(n, n->on_close, {
      napi_value argv[1];
      napi_get_null(env, &(argv[0]));
      NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 1, argv, NULL)
    })
  } else {
    UDX_NAPI_CALLBACK(n, n->on_close, {
      napi_value argv[1];
      napi_value code;
      napi_value msg;
      napi_create_string_utf8(env, uv_err_name(status), NAPI_AUTO_LENGTH, &code);
      napi_create_string_utf8(env, uv_strerror(status), NAPI_AUTO_LENGTH, &msg);
      napi_create_error(env, code, msg, &(argv[0]));
      NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 1, argv, NULL)
    })
  }

  napi_delete_reference(n->env, n->on_data);
  napi_delete_reference(n->env, n->on_end);
  napi_delete_reference(n->env, n->on_drain);
  napi_delete_reference(n->env, n->on_ack);
  napi_delete_reference(n->env, n->on_send);
  napi_delete_reference(n->env, n->on_message);
  napi_delete_reference(n->env, n->on_close);
  napi_delete_reference(n->env, n->on_firewall);
  napi_delete_reference(n->env, n->on_remote_changed);
  napi_delete_reference(n->env, n->realloc_data);
  napi_delete_reference(n->env, n->realloc_message);
  napi_delete_reference(n->env, n->ctx);
}

static int
on_udx_stream_firewall (udx_stream_t *stream, udx_socket_t *socket, const struct sockaddr *from) {
  udx_napi_stream_t *n = (udx_napi_stream_t *) stream;
  udx_napi_socket_t *s = (udx_napi_socket_t *) socket;

  uint32_t fw = 1; // assume error means firewall it, whilst reporting the uncaught

  int port = 0;
  char ip[INET6_ADDRSTRLEN];
  int family = 0;
  parse_address((struct sockaddr *) from, ip, INET6_ADDRSTRLEN, &port, &family);

  UDX_NAPI_CALLBACK(n, n->on_firewall, {
    napi_value res;
    napi_value argv[4];

    napi_get_reference_value(env, s->ctx, &(argv[0]));
    napi_create_uint32(env, port, &(argv[1]));
    napi_create_string_utf8(env, ip, NAPI_AUTO_LENGTH, &(argv[2]));
    napi_create_uint32(env, family, &(argv[3]));

    if (napi_make_callback(env, NULL, ctx, callback, 4, argv, &res) == napi_pending_exception) {
      napi_value fatal_exception;
      napi_get_and_clear_last_exception(env, &fatal_exception);
      napi_fatal_exception(env, fatal_exception);
    } else {
      napi_get_value_uint32(env, res, &fw);
    }
  })

  return fw;
}

static void
on_udx_stream_remote_changed (udx_stream_t *stream) {
  udx_napi_stream_t *n = (udx_napi_stream_t *) stream;

  UDX_NAPI_CALLBACK(n, n->on_remote_changed, {
    NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 0, NULL, NULL);
  })
}

static void
on_udx_lookup (udx_lookup_t *lookup, int status, const struct sockaddr *addr, int addr_len) {
  udx_napi_lookup_t *n = (udx_napi_lookup_t *) lookup;

  char ip[INET6_ADDRSTRLEN] = "";
  int family = 0;

  if (status >= 0) {
    if (addr->sa_family == AF_INET) {
      uv_ip4_name((struct sockaddr_in *) addr, ip, addr_len);
      family = 4;
    } else if (addr->sa_family == AF_INET6) {
      uv_ip6_name((struct sockaddr_in6 *) addr, ip, addr_len);
      family = 6;
    }

    UDX_NAPI_CALLBACK(n, n->on_lookup, {
      napi_value argv[3];
      napi_get_null(env, &(argv[0]));
      napi_create_string_utf8(env, ip, NAPI_AUTO_LENGTH, &(argv[1]));
      napi_create_uint32(env, family, &(argv[2]));
      NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 3, argv, NULL)
    })
  } else {
    UDX_NAPI_CALLBACK(n, n->on_lookup, {
      napi_value argv[1];
      napi_value code;
      napi_value msg;
      napi_create_string_utf8(env, uv_err_name(status), NAPI_AUTO_LENGTH, &code);
      napi_create_string_utf8(env, uv_strerror(status), NAPI_AUTO_LENGTH, &msg);
      napi_create_error(env, code, msg, &(argv[0]));
      NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 1, argv, NULL)
    })
  }

  free(n->host);

  napi_delete_reference(n->env, n->on_lookup);
  napi_delete_reference(n->env, n->ctx);
}

static void
on_udx_interface_event (udx_interface_event_t *handle, int status) {
  udx_napi_interface_event_t *e = (udx_napi_interface_event_t *) handle;

  UDX_NAPI_CALLBACK(e, e->on_event, {NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 0, NULL, NULL)})
}

static void
on_udx_interface_event_close (udx_interface_event_t *handle) {
  udx_napi_interface_event_t *e = (udx_napi_interface_event_t *) handle;

  UDX_NAPI_CALLBACK(e, e->on_close, {NAPI_MAKE_CALLBACK(env, NULL, ctx, callback, 0, NULL, NULL)})

  napi_delete_reference(env, e->on_event);
  napi_delete_reference(env, e->on_close);
  napi_delete_reference(env, e->ctx);
}

NAPI_METHOD(udx_napi_init) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_napi_t *, self, 0)
  NAPI_ARGV_BUFFER(read_buf, 1)

  uv_loop_t *loop;
  napi_get_uv_event_loop(env, &loop);

  udx_init(loop, &(self->udx));

  self->read_buf = read_buf;
  self->read_buf_free = read_buf_len;

  return NULL;
}

NAPI_METHOD(udx_napi_socket_init) {
  NAPI_ARGV(7)
  NAPI_ARGV_BUFFER_CAST(udx_napi_t *, udx, 0)
  NAPI_ARGV_BUFFER_CAST(udx_napi_socket_t *, self, 1)

  udx_socket_t *socket = (udx_socket_t *) self;

  self->udx = udx;
  self->env = env;
  napi_create_reference(env, argv[2], 1, &(self->ctx));
  napi_create_reference(env, argv[3], 1, &(self->on_send));
  napi_create_reference(env, argv[4], 1, &(self->on_message));
  napi_create_reference(env, argv[5], 1, &(self->on_close));
  napi_create_reference(env, argv[6], 1, &(self->realloc_message));

  int err = udx_socket_init((udx_t *) udx, socket);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_socket_bind) {
  NAPI_ARGV(5)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, self, 0)
  NAPI_ARGV_UINT32(port, 1)
  NAPI_ARGV_UTF8(ip, INET6_ADDRSTRLEN, 2)
  NAPI_ARGV_UINT32(family, 3)
  NAPI_ARGV_UINT32(flags, 4)

  int err;

  struct sockaddr_storage addr;
  int addr_len;

  if (family == 4) {
    addr_len = sizeof(struct sockaddr_in);
    err = uv_ip4_addr(ip, port, (struct sockaddr_in *) &addr);
  } else {
    addr_len = sizeof(struct sockaddr_in6);
    err = uv_ip6_addr(ip, port, (struct sockaddr_in6 *) &addr);
  }

  if (err < 0) UDX_NAPI_THROW(err)

  err = udx_socket_bind(self, (struct sockaddr *) &addr, flags);
  if (err < 0) UDX_NAPI_THROW(err)

  // TODO: move the bottom stuff into another function, start, so error handling is easier

  struct sockaddr_storage name;

  // wont error in practice
  err = udx_socket_getsockname(self, (struct sockaddr *) &name, &addr_len);
  if (err < 0) UDX_NAPI_THROW(err)

  int local_port;

  if (family == 4) {
    local_port = ntohs(((struct sockaddr_in *) &name)->sin_port);
  } else {
    local_port = ntohs(((struct sockaddr_in6 *) &name)->sin6_port);
  }

  // wont error in practice
  err = udx_socket_recv_start(self, on_udx_message);
  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(local_port)
}

NAPI_METHOD(udx_napi_socket_set_ttl) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, self, 0)
  NAPI_ARGV_UINT32(ttl, 1)

  int err = udx_socket_set_ttl(self, ttl);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_socket_get_recv_buffer_size) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, self, 0)

  int size = 0;

  int err = udx_socket_get_recv_buffer_size(self, &size);
  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(size)
}

NAPI_METHOD(udx_napi_socket_set_recv_buffer_size) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, self, 0)
  NAPI_ARGV_INT32(size, 1)

  int err = udx_socket_set_recv_buffer_size(self, size);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_socket_get_send_buffer_size) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, self, 0)

  int size = 0;

  int err = udx_socket_get_send_buffer_size(self, &size);
  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(size)
}

NAPI_METHOD(udx_napi_socket_set_send_buffer_size) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, self, 0)
  NAPI_ARGV_INT32(size, 1)

  int err = udx_socket_set_send_buffer_size(self, size);
  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(size)
}

NAPI_METHOD(udx_napi_socket_send_ttl) {
  NAPI_ARGV(8)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, self, 0)
  NAPI_ARGV_BUFFER_CAST(udx_socket_send_t *, req, 1)
  NAPI_ARGV_UINT32(rid, 2)
  NAPI_ARGV_BUFFER(buf, 3)
  NAPI_ARGV_UINT32(port, 4)
  NAPI_ARGV_UTF8(ip, INET6_ADDRSTRLEN, 5)
  NAPI_ARGV_UINT32(family, 6)
  NAPI_ARGV_UINT32(ttl, 7)

  req->data = (void *) ((uintptr_t) rid);

  int err;

  struct sockaddr_storage addr;

  if (family == 4) {
    err = uv_ip4_addr(ip, port, (struct sockaddr_in *) &addr);
  } else {
    err = uv_ip6_addr(ip, port, (struct sockaddr_in6 *) &addr);
  }

  if (err < 0) UDX_NAPI_THROW(err)

  uv_buf_t b = uv_buf_init(buf, buf_len);

  udx_socket_send_ttl(req, self, &b, 1, (const struct sockaddr *) &addr, ttl, on_udx_send);

  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_socket_close) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, self, 0)

  int err = udx_socket_close(self, on_udx_close);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_stream_init) {
  NAPI_ARGV(16)
  NAPI_ARGV_BUFFER_CAST(udx_napi_t *, udx, 0)
  NAPI_ARGV_BUFFER_CAST(udx_napi_stream_t *, self, 1)
  NAPI_ARGV_UINT32(id, 2)
  NAPI_ARGV_UINT32(framed, 3)

  udx_stream_t *stream = (udx_stream_t *) self;

  self->mode = framed ? UDX_NAPI_FRAMED : UDX_NAPI_INTERACTIVE;

  self->frame_len = -1;

  self->read_buf = NULL;
  self->read_buf_head = NULL;
  self->read_buf_free = 0;

  self->udx = udx;
  self->env = env;
  napi_create_reference(env, argv[4], 1, &(self->ctx));
  napi_create_reference(env, argv[5], 1, &(self->on_data));
  napi_create_reference(env, argv[6], 1, &(self->on_end));
  napi_create_reference(env, argv[7], 1, &(self->on_drain));
  napi_create_reference(env, argv[8], 1, &(self->on_ack));
  napi_create_reference(env, argv[9], 1, &(self->on_send));
  napi_create_reference(env, argv[10], 1, &(self->on_message));
  napi_create_reference(env, argv[11], 1, &(self->on_close));
  napi_create_reference(env, argv[12], 1, &(self->on_firewall));
  napi_create_reference(env, argv[13], 1, &(self->on_remote_changed));
  napi_create_reference(env, argv[14], 1, &(self->realloc_data));
  napi_create_reference(env, argv[15], 1, &(self->realloc_message));

  int err = udx_stream_init((udx_t *) udx, stream, id, on_udx_stream_close);
  if (err < 0) UDX_NAPI_THROW(err)

  udx_stream_firewall(stream, on_udx_stream_firewall);
  udx_stream_write_resume(stream, on_udx_stream_drain);

  return NULL;
}

NAPI_METHOD(udx_napi_stream_set_seq) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_UINT32(seq, 1)

  int err = udx_stream_set_seq(stream, seq);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_stream_set_ack) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_UINT32(ack, 1)

  int err = udx_stream_set_ack(stream, ack);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_stream_set_mode) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_napi_stream_t *, stream, 0)
  NAPI_ARGV_UINT32(mode, 1)

  stream->mode = mode;

  return NULL;
}

NAPI_METHOD(udx_napi_stream_recv_start) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_napi_stream_t *, stream, 0)
  NAPI_ARGV_BUFFER(read_buf, 1)

  stream->read_buf = read_buf;
  stream->read_buf_head = read_buf;
  stream->read_buf_free = read_buf_len;

  udx_stream_read_start((udx_stream_t *) stream, on_udx_stream_read);
  udx_stream_recv_start((udx_stream_t *) stream, on_udx_stream_recv);

  return NULL;
}

NAPI_METHOD(udx_napi_stream_connect) {
  NAPI_ARGV(6)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, socket, 1)
  NAPI_ARGV_UINT32(remote_id, 2)
  NAPI_ARGV_UINT32(port, 3)
  NAPI_ARGV_UTF8(ip, INET6_ADDRSTRLEN, 4)
  NAPI_ARGV_UINT32(family, 5)

  int err;

  struct sockaddr_storage addr;

  if (family == 4) {
    err = uv_ip4_addr(ip, port, (struct sockaddr_in *) &addr);
  } else {
    err = uv_ip6_addr(ip, port, (struct sockaddr_in6 *) &addr);
  }

  if (err < 0) UDX_NAPI_THROW(err)

  err = udx_stream_connect(stream, socket, remote_id, (const struct sockaddr *) &addr);

  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_stream_change_remote) {
  NAPI_ARGV(6)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_BUFFER_CAST(udx_socket_t *, socket, 1)
  NAPI_ARGV_UINT32(remote_id, 2)
  NAPI_ARGV_UINT32(port, 3)
  NAPI_ARGV_UTF8(ip, INET6_ADDRSTRLEN, 4)
  NAPI_ARGV_UINT32(family, 5)

  int err;

  struct sockaddr_storage addr;

  if (family == 4) {
    err = uv_ip4_addr(ip, port, (struct sockaddr_in *) &addr);
  } else {
    err = uv_ip6_addr(ip, port, (struct sockaddr_in6 *) &addr);
  }

  if (err < 0) UDX_NAPI_THROW(err)

  err = udx_stream_change_remote(stream, socket, remote_id, (const struct sockaddr *) &addr, on_udx_stream_remote_changed);

  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_stream_relay_to) {
  NAPI_ARGV(2)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, destination, 1)

  int err = udx_stream_relay_to(stream, destination);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_stream_send) {
  NAPI_ARGV(4)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_BUFFER_CAST(udx_stream_send_t *, req, 1)
  NAPI_ARGV_UINT32(rid, 2)
  NAPI_ARGV_BUFFER(buf, 3)

  req->data = (void *) ((uintptr_t) rid);

  uv_buf_t b = uv_buf_init(buf, buf_len);

  int err = udx_stream_send(req, stream, &b, 1, on_udx_stream_send);
  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(err);
}

NAPI_METHOD(udx_napi_stream_write) {
  NAPI_ARGV(4)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_BUFFER_CAST(udx_stream_write_t *, req, 1)
  NAPI_ARGV_UINT32(rid, 2)
  NAPI_ARGV_BUFFER(buf, 3)

  req->data = (void *) ((uintptr_t) rid);

  uv_buf_t b = uv_buf_init(buf, buf_len);

  int err = udx_stream_write(req, stream, &b, 1, on_udx_stream_ack);
  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(err);
}

NAPI_METHOD(udx_napi_stream_writev) {
  NAPI_ARGV(4)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_BUFFER_CAST(udx_stream_write_t *, req, 1)
  NAPI_ARGV_UINT32(rid, 2)

  napi_value buffers = argv[3];

  req->data = (void *) ((uintptr_t) rid);

  uint32_t len;
  napi_get_array_length(env, buffers, &len);
  uv_buf_t *batch = malloc(sizeof(uv_buf_t) * len);

  napi_value element;
  for (uint32_t i = 0; i < len; i++) {
    napi_get_element(env, buffers, i, &element);
    NAPI_BUFFER(buf, element)
    batch[i] = uv_buf_init(buf, buf_len);
  }

  int err = udx_stream_write(req, stream, batch, len, on_udx_stream_ack);
  free(batch);

  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(err);
}

NAPI_METHOD(udx_napi_stream_write_sizeof) {
  NAPI_ARGV(1)
  NAPI_ARGV_UINT32(bufs, 0)
  NAPI_RETURN_UINT32(udx_stream_write_sizeof(bufs))
}

NAPI_METHOD(udx_napi_stream_write_end) {
  NAPI_ARGV(4)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)
  NAPI_ARGV_BUFFER_CAST(udx_stream_write_t *, req, 1)
  NAPI_ARGV_UINT32(rid, 2)
  NAPI_ARGV_BUFFER(buf, 3)

  req->data = (void *) ((uintptr_t) rid);

  uv_buf_t b = uv_buf_init(buf, buf_len);

  int err = udx_stream_write_end(req, stream, &b, 1, on_udx_stream_ack);
  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(err);
}

NAPI_METHOD(udx_napi_stream_destroy) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(udx_stream_t *, stream, 0)

  int err = udx_stream_destroy(stream);
  if (err < 0) UDX_NAPI_THROW(err)

  NAPI_RETURN_UINT32(err);
}

NAPI_METHOD(udx_napi_lookup) {
  NAPI_ARGV(5)
  NAPI_ARGV_BUFFER_CAST(udx_napi_lookup_t *, self, 0)
  NAPI_ARGV_UTF8_MALLOC(host, 1)
  NAPI_ARGV_UINT32(family, 2)

  udx_lookup_t *lookup = (udx_lookup_t *) self;

  uv_loop_t *loop;
  napi_get_uv_event_loop(env, &loop);

  self->host = host;
  self->env = env;
  napi_create_reference(env, argv[3], 1, &(self->ctx));
  napi_create_reference(env, argv[4], 1, &(self->on_lookup));

  int flags = 0;

  if (family == 4) flags |= UDX_LOOKUP_FAMILY_IPV4;
  if (family == 6) flags |= UDX_LOOKUP_FAMILY_IPV6;

  int err = udx_lookup(loop, lookup, host, flags, on_udx_lookup);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_interface_event_init) {
  NAPI_ARGV(4)
  NAPI_ARGV_BUFFER_CAST(udx_napi_interface_event_t *, self, 0)

  udx_interface_event_t *event = (udx_interface_event_t *) self;

  uv_loop_t *loop;
  napi_get_uv_event_loop(env, &loop);

  self->env = env;
  napi_create_reference(env, argv[1], 1, &(self->ctx));
  napi_create_reference(env, argv[2], 1, &(self->on_event));
  napi_create_reference(env, argv[3], 1, &(self->on_close));

  int err = udx_interface_event_init(loop, event);
  if (err < 0) UDX_NAPI_THROW(err)

  err = udx_interface_event_start(event, on_udx_interface_event, 5000);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_interface_event_start) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(udx_interface_event_t *, event, 0)

  int err = udx_interface_event_start(event, on_udx_interface_event, 5000);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_interface_event_stop) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(udx_interface_event_t *, event, 0)

  int err = udx_interface_event_stop(event);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_interface_event_close) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(udx_interface_event_t *, event, 0)

  int err = udx_interface_event_close(event, on_udx_interface_event_close);
  if (err < 0) UDX_NAPI_THROW(err)

  return NULL;
}

NAPI_METHOD(udx_napi_interface_event_get_addrs) {
  NAPI_ARGV(1)
  NAPI_ARGV_BUFFER_CAST(udx_interface_event_t *, event, 0)

  char ip[INET6_ADDRSTRLEN];
  int family = 0;

  napi_value napi_result;
  napi_create_array(env, &napi_result);

  for (int i = 0, j = 0; i < event->addrs_len; i++) {
    uv_interface_address_t addr = event->addrs[i];

    if (addr.address.address4.sin_family == AF_INET) {
      uv_ip4_name(&addr.address.address4, ip, sizeof(ip));
      family = 4;
    } else if (addr.address.address4.sin_family == AF_INET6) {
      uv_ip6_name(&addr.address.address6, ip, sizeof(ip));
      family = 6;
    } else {
      continue;
    }

    napi_value napi_item;
    napi_create_object(env, &napi_item);
    napi_set_element(env, napi_result, j++, napi_item);

    napi_value napi_name;
    napi_create_string_utf8(env, addr.name, NAPI_AUTO_LENGTH, &napi_name);
    napi_set_named_property(env, napi_item, "name", napi_name);

    napi_value napi_ip;
    napi_create_string_utf8(env, ip, NAPI_AUTO_LENGTH, &napi_ip);
    napi_set_named_property(env, napi_item, "host", napi_ip);

    napi_value napi_family;
    napi_create_uint32(env, family, &napi_family);
    napi_set_named_property(env, napi_item, "family", napi_family);

    napi_value napi_internal;
    napi_get_boolean(env, addr.is_internal, &napi_internal);
    napi_set_named_property(env, napi_item, "internal", napi_internal);
  }

  return napi_result;
}

NAPI_INIT() {
  NAPI_EXPORT_UINT32(UV_UDP_IPV6ONLY)

  NAPI_EXPORT_OFFSETOF(udx_stream_t, inflight)
  NAPI_EXPORT_OFFSETOF(udx_stream_t, mtu)
  NAPI_EXPORT_OFFSETOF(udx_stream_t, cwnd)
  NAPI_EXPORT_OFFSETOF(udx_stream_t, srtt)
  NAPI_EXPORT_OFFSETOF(udx_stream_t, pkts_inflight)

  NAPI_EXPORT_SIZEOF(udx_napi_t)
  NAPI_EXPORT_SIZEOF(udx_napi_socket_t)
  NAPI_EXPORT_SIZEOF(udx_napi_stream_t)
  NAPI_EXPORT_SIZEOF(udx_napi_lookup_t)
  NAPI_EXPORT_SIZEOF(udx_napi_interface_event_t)

  NAPI_EXPORT_SIZEOF(udx_socket_send_t)
  NAPI_EXPORT_SIZEOF(udx_stream_send_t)

  NAPI_EXPORT_FUNCTION(udx_napi_init)

  NAPI_EXPORT_FUNCTION(udx_napi_socket_init)
  NAPI_EXPORT_FUNCTION(udx_napi_socket_bind)
  NAPI_EXPORT_FUNCTION(udx_napi_socket_set_ttl)
  NAPI_EXPORT_FUNCTION(udx_napi_socket_get_recv_buffer_size)
  NAPI_EXPORT_FUNCTION(udx_napi_socket_set_recv_buffer_size)
  NAPI_EXPORT_FUNCTION(udx_napi_socket_get_send_buffer_size)
  NAPI_EXPORT_FUNCTION(udx_napi_socket_set_send_buffer_size)
  NAPI_EXPORT_FUNCTION(udx_napi_socket_send_ttl)
  NAPI_EXPORT_FUNCTION(udx_napi_socket_close)

  NAPI_EXPORT_FUNCTION(udx_napi_stream_init)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_set_seq)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_set_ack)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_set_mode)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_connect)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_change_remote)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_relay_to)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_send)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_recv_start)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_write)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_writev)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_write_sizeof)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_write_end)
  NAPI_EXPORT_FUNCTION(udx_napi_stream_destroy)

  NAPI_EXPORT_FUNCTION(udx_napi_lookup)

  NAPI_EXPORT_FUNCTION(udx_napi_interface_event_init)
  NAPI_EXPORT_FUNCTION(udx_napi_interface_event_start)
  NAPI_EXPORT_FUNCTION(udx_napi_interface_event_stop)
  NAPI_EXPORT_FUNCTION(udx_napi_interface_event_close)
  NAPI_EXPORT_FUNCTION(udx_napi_interface_event_get_addrs)
}
