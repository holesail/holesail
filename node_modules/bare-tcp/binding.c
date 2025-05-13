#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdlib.h>
#include <uv.h>

typedef struct {
  uv_tcp_t handle;

  struct {
    uv_connect_t connect;
    uv_write_t write;
    uv_shutdown_t shutdown;
  } requests;

  uv_buf_t read;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_connection;
  js_ref_t *on_connect;
  js_ref_t *on_read;
  js_ref_t *on_write;
  js_ref_t *on_end;
  js_ref_t *on_close;

  bool closing;
  bool exiting;

  js_deferred_teardown_t *teardown;
} bare_tcp_t;

static void
bare_tcp__on_connection(uv_stream_t *server, int status) {
  int err;

  bare_tcp_t *tcp = (bare_tcp_t *) server;

  if (tcp->closing) return;

  js_env_t *env = tcp->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tcp->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_connection;
  err = js_get_reference_value(env, tcp->on_connection, &on_connection);
  assert(err == 0);

  js_value_t *argv[1];

  if (status < 0) {
    js_value_t *code;
    err = js_create_string_utf8(env, (utf8_t *) uv_err_name(status), -1, &code);
    assert(err == 0);

    js_value_t *message;
    err = js_create_string_utf8(env, (utf8_t *) uv_strerror(status), -1, &message);
    assert(err == 0);

    err = js_create_error(env, code, message, &argv[0]);
    assert(err == 0);
  } else {
    err = js_get_null(env, &argv[0]);
    assert(err == 0);
  }

  js_call_function(env, ctx, on_connection, 1, argv, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_tcp__on_connect(uv_connect_t *req, int status) {
  int err;

  bare_tcp_t *tcp = (bare_tcp_t *) req->data;

  if (tcp->exiting) return;

  js_env_t *env = tcp->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tcp->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_connect;
  err = js_get_reference_value(env, tcp->on_connect, &on_connect);
  assert(err == 0);

  js_value_t *argv[1];

  if (status < 0) {
    js_value_t *code;
    err = js_create_string_utf8(env, (utf8_t *) uv_err_name(status), -1, &code);
    assert(err == 0);

    js_value_t *message;
    err = js_create_string_utf8(env, (utf8_t *) uv_strerror(status), -1, &message);
    assert(err == 0);

    err = js_create_error(env, code, message, &argv[0]);
    assert(err == 0);
  } else {
    err = js_get_null(env, &argv[0]);
    assert(err == 0);
  }

  js_call_function(env, ctx, on_connect, 1, argv, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_tcp__on_read(uv_stream_t *stream, ssize_t nread, const uv_buf_t *buf) {
  if (nread == UV_EOF) nread = 0;
  else if (nread == 0) return;

  int err;

  bare_tcp_t *tcp = (bare_tcp_t *) stream;

  if (tcp->exiting) return;

  js_env_t *env = tcp->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tcp->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_read;
  err = js_get_reference_value(env, tcp->on_read, &on_read);
  assert(err == 0);

  js_value_t *argv[2];

  if (nread < 0) {
    js_value_t *code;
    err = js_create_string_utf8(env, (utf8_t *) uv_err_name(nread), -1, &code);
    assert(err == 0);

    js_value_t *message;
    err = js_create_string_utf8(env, (utf8_t *) uv_strerror(nread), -1, &message);
    assert(err == 0);

    err = js_create_error(env, code, message, &argv[0]);
    assert(err == 0);

    err = js_create_int32(env, 0, &argv[1]);
    assert(err == 0);
  } else {
    err = js_get_null(env, &argv[0]);
    assert(err == 0);

    err = js_create_int32(env, nread, &argv[1]);
    assert(err == 0);
  }

  js_call_function(env, ctx, on_read, 2, argv, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_tcp__on_write(uv_write_t *req, int status) {
  int err;

  bare_tcp_t *tcp = (bare_tcp_t *) req->data;

  if (tcp->exiting) return;

  js_env_t *env = tcp->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tcp->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_write;
  err = js_get_reference_value(env, tcp->on_write, &on_write);
  assert(err == 0);

  js_value_t *argv[1];

  if (status < 0) {
    js_value_t *code;
    err = js_create_string_utf8(env, (utf8_t *) uv_err_name(status), -1, &code);
    assert(err == 0);

    js_value_t *message;
    err = js_create_string_utf8(env, (utf8_t *) uv_strerror(status), -1, &message);
    assert(err == 0);

    err = js_create_error(env, code, message, &argv[0]);
    assert(err == 0);
  } else {
    err = js_get_null(env, &argv[0]);
    assert(err == 0);
  }

  js_call_function(env, ctx, on_write, 1, argv, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_tcp__on_shutdown(uv_shutdown_t *req, int status) {
  int err;

  bare_tcp_t *tcp = (bare_tcp_t *) req->data;

  if (tcp->exiting) return;

  js_env_t *env = tcp->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tcp->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_end;
  err = js_get_reference_value(env, tcp->on_end, &on_end);
  assert(err == 0);

  js_value_t *argv[1];

  if (status < 0) {
    js_value_t *code;
    err = js_create_string_utf8(env, (utf8_t *) uv_err_name(status), -1, &code);
    assert(err == 0);

    js_value_t *message;
    err = js_create_string_utf8(env, (utf8_t *) uv_strerror(status), -1, &message);
    assert(err == 0);

    err = js_create_error(env, code, message, &argv[0]);
    assert(err == 0);
  } else {
    err = js_get_null(env, &argv[0]);
    assert(err == 0);
  }

  js_call_function(env, ctx, on_end, 1, argv, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_tcp__on_close(uv_handle_t *handle) {
  int err;

  bare_tcp_t *tcp = (bare_tcp_t *) handle;

  js_env_t *env = tcp->env;

  js_deferred_teardown_t *teardown = tcp->teardown;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tcp->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_close;
  err = js_get_reference_value(env, tcp->on_close, &on_close);
  assert(err == 0);

  err = js_delete_reference(env, tcp->on_connection);
  assert(err == 0);

  err = js_delete_reference(env, tcp->on_connect);
  assert(err == 0);

  err = js_delete_reference(env, tcp->on_read);
  assert(err == 0);

  err = js_delete_reference(env, tcp->on_write);
  assert(err == 0);

  err = js_delete_reference(env, tcp->on_end);
  assert(err == 0);

  err = js_delete_reference(env, tcp->on_close);
  assert(err == 0);

  err = js_delete_reference(env, tcp->ctx);
  assert(err == 0);

  if (!tcp->exiting) js_call_function(env, ctx, on_close, 0, NULL, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  err = js_finish_deferred_teardown_callback(teardown);
  assert(err == 0);
}

static void
bare_tcp__on_teardown(js_deferred_teardown_t *handle, void *data) {
  bare_tcp_t *tcp = (bare_tcp_t *) data;

  tcp->exiting = true;

  if (tcp->closing) return;

  uv_close((uv_handle_t *) &tcp->handle, bare_tcp__on_close);
}

static void
bare_tcp__on_alloc(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
  bare_tcp_t *tcp = (bare_tcp_t *) handle;

  *buf = tcp->read;
}

static js_value_t *
bare_tcp_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 8;
  js_value_t *argv[8];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 8);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  js_value_t *handle;

  bare_tcp_t *tcp;
  err = js_create_arraybuffer(env, sizeof(bare_tcp_t), (void **) &tcp, &handle);
  assert(err == 0);

  err = uv_tcp_init(loop, &tcp->handle);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  tcp->env = env;
  tcp->closing = false;
  tcp->exiting = false;

  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &tcp->read.base, (size_t *) &tcp->read.len, NULL, NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[1], 1, &tcp->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &tcp->on_connection);
  assert(err == 0);

  err = js_create_reference(env, argv[3], 1, &tcp->on_connect);
  assert(err == 0);

  err = js_create_reference(env, argv[4], 1, &tcp->on_read);
  assert(err == 0);

  err = js_create_reference(env, argv[5], 1, &tcp->on_write);
  assert(err == 0);

  err = js_create_reference(env, argv[6], 1, &tcp->on_end);
  assert(err == 0);

  err = js_create_reference(env, argv[7], 1, &tcp->on_close);
  assert(err == 0);

  err = js_add_deferred_teardown_callback(env, bare_tcp__on_teardown, (void *) tcp, &tcp->teardown);
  assert(err == 0);

  return handle;
}

static js_value_t *
bare_tcp_connect(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  uint32_t port;
  err = js_get_value_uint32(env, argv[1], &port);
  assert(err == 0);

  utf8_t ip[INET6_ADDRSTRLEN];
  err = js_get_value_string_utf8(env, argv[2], ip, INET6_ADDRSTRLEN, NULL);
  assert(err == 0);

  uint32_t family;
  err = js_get_value_uint32(env, argv[3], &family);
  assert(err == 0);

  struct sockaddr_storage addr;

  if (family == 4) {
    err = uv_ip4_addr((char *) ip, port, (struct sockaddr_in *) &addr);
  } else {
    err = uv_ip6_addr((char *) ip, port, (struct sockaddr_in6 *) &addr);
  }

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  uv_connect_t *req = &tcp->requests.connect;

  req->data = tcp;

  err = uv_tcp_connect(req, &tcp->handle, (struct sockaddr *) &addr, bare_tcp__on_connect);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tcp_bind(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  uint32_t port;
  err = js_get_value_uint32(env, argv[1], &port);
  assert(err == 0);

  utf8_t ip[INET6_ADDRSTRLEN];
  err = js_get_value_string_utf8(env, argv[2], ip, INET6_ADDRSTRLEN, NULL);
  assert(err == 0);

  uint32_t backlog;
  err = js_get_value_uint32(env, argv[3], &backlog);
  assert(err == 0);

  uint32_t family;
  err = js_get_value_uint32(env, argv[4], &family);
  assert(err == 0);

  struct sockaddr_storage addr;
  int addr_len;

  if (family == 4) {
    addr_len = sizeof(struct sockaddr_in);
    err = uv_ip4_addr((char *) ip, port, (struct sockaddr_in *) &addr);
  } else {
    addr_len = sizeof(struct sockaddr_in6);
    err = uv_ip6_addr((char *) ip, port, (struct sockaddr_in6 *) &addr);
  }

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  err = uv_tcp_bind(&tcp->handle, (struct sockaddr *) &addr, 0);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  err = uv_listen((uv_stream_t *) &tcp->handle, backlog, bare_tcp__on_connection);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  struct sockaddr_storage name;
  err = uv_tcp_getsockname(&tcp->handle, (struct sockaddr *) &name, &addr_len);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  int local_port;

  if (family == 4) {
    local_port = ntohs(((struct sockaddr_in *) &name)->sin_port);
  } else {
    local_port = ntohs(((struct sockaddr_in6 *) &name)->sin6_port);
  }

  js_value_t *res;
  err = js_create_uint32(env, local_port, &res);
  assert(err == 0);

  return res;
}

static js_value_t *
bare_tcp_accept(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_tcp_t *server;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &server, NULL);
  assert(err == 0);

  bare_tcp_t *client;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &client, NULL);
  assert(err == 0);

  err = uv_accept((uv_stream_t *) &server->handle, (uv_stream_t *) &client->handle);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tcp_resume(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  if (!uv_is_readable((uv_stream_t *) &tcp->handle)) return NULL;

  err = uv_read_start((uv_stream_t *) &tcp->handle, bare_tcp__on_alloc, bare_tcp__on_read);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tcp_pause(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  if (!uv_is_readable((uv_stream_t *) &tcp->handle)) return NULL;

  err = uv_read_stop((uv_stream_t *) &tcp->handle);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tcp_writev(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  js_value_t *arr = argv[1];

  uint32_t bufs_len;
  err = js_get_array_length(env, arr, &bufs_len);
  assert(err == 0);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  js_value_t **elements = malloc(sizeof(js_value_t *) * bufs_len);

  uint32_t fetched;
  err = js_get_array_elements(env, arr, elements, bufs_len, 0, &fetched);
  assert(err == 0);
  assert(fetched == bufs_len);

  for (uint32_t i = 0; i < bufs_len; i++) {
    js_value_t *item = elements[i];

    uv_buf_t *buf = &bufs[i];
    err = js_get_typedarray_info(env, item, NULL, (void **) &buf->base, (size_t *) &buf->len, NULL, NULL);
    assert(err == 0);
  }

  free(elements);

  uv_write_t *req = &tcp->requests.write;

  req->data = tcp;

  err = uv_write(req, (uv_stream_t *) &tcp->handle, bufs, bufs_len, bare_tcp__on_write);

  free(bufs);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tcp_end(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  uv_shutdown_t *req = &tcp->requests.shutdown;

  req->data = tcp;

  err = uv_shutdown(req, (uv_stream_t *) &tcp->handle, bare_tcp__on_shutdown);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tcp_close(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  tcp->closing = true;

  uv_close((uv_handle_t *) &tcp->handle, bare_tcp__on_close);

  return NULL;
}

static js_value_t *
bare_tcp_keepalive(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  bool enable;
  err = js_get_value_bool(env, argv[1], &enable);
  assert(err == 0);

  uint32_t delay;
  err = js_get_value_uint32(env, argv[2], &delay);
  assert(err == 0);

  err = uv_tcp_keepalive(&tcp->handle, enable, delay);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_tcp_nodelay(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  bool enable;
  err = js_get_value_bool(env, argv[1], &enable);
  assert(err == 0);

  err = uv_tcp_nodelay(&tcp->handle, enable);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_tcp_ref(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  uv_ref((uv_handle_t *) &tcp->handle);

  return NULL;
}

static js_value_t *
bare_tcp_unref(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tcp_t *tcp;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tcp, NULL);
  assert(err == 0);

  uv_unref((uv_handle_t *) &tcp->handle);

  return NULL;
}

static js_value_t *
bare_tcp_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("init", bare_tcp_init)
  V("connect", bare_tcp_connect)
  V("bind", bare_tcp_bind)
  V("accept", bare_tcp_accept)
  V("resume", bare_tcp_resume)
  V("pause", bare_tcp_pause)
  V("writev", bare_tcp_writev)
  V("end", bare_tcp_end)
  V("close", bare_tcp_close)
  V("keepalive", bare_tcp_keepalive)
  V("nodelay", bare_tcp_nodelay)
  V("ref", bare_tcp_ref)
  V("unref", bare_tcp_unref)
#undef V

  return exports;
}

BARE_MODULE(bare_tcp, bare_tcp_exports)
