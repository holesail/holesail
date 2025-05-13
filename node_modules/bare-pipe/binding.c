#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdlib.h>
#include <string.h>
#include <utf.h>
#include <uv.h>

typedef struct {
  uv_pipe_t handle;

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
  js_ref_t *on_write;
  js_ref_t *on_end;
  js_ref_t *on_read;
  js_ref_t *on_close;

  bool closing;
  bool exiting;

  js_deferred_teardown_t *teardown;
} bare_pipe_t;

enum {
  bare_pipe_readable = 0x1,
  bare_pipe_writable = 0x2
};

typedef utf8_t bare_pipe_path_t[4096 + 1 /* NULL */];

static void
bare_pipe__on_connection(uv_stream_t *server, int status) {
  int err;

  bare_pipe_t *pipe = (bare_pipe_t *) server;

  if (pipe->exiting) return;

  js_env_t *env = pipe->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, pipe->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_connection;
  err = js_get_reference_value(env, pipe->on_connection, &on_connection);
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
bare_pipe__on_connect(uv_connect_t *req, int status) {
  int err;

  bare_pipe_t *pipe = (bare_pipe_t *) req->data;

  if (pipe->exiting) return;

  js_env_t *env = pipe->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, pipe->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_connect;
  err = js_get_reference_value(env, pipe->on_connect, &on_connect);
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
bare_pipe__on_write(uv_write_t *req, int status) {
  int err;

  bare_pipe_t *pipe = (bare_pipe_t *) req->data;

  if (pipe->exiting) return;

  js_env_t *env = pipe->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, pipe->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_write;
  err = js_get_reference_value(env, pipe->on_write, &on_write);
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
bare_pipe__on_shutdown(uv_shutdown_t *req, int status) {
  int err;

  bare_pipe_t *pipe = (bare_pipe_t *) req->data;

  if (pipe->exiting) return;

  js_env_t *env = pipe->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, pipe->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_end;
  err = js_get_reference_value(env, pipe->on_end, &on_end);
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
bare_pipe__on_read(uv_stream_t *stream, ssize_t nread, const uv_buf_t *buf) {
  if (nread == UV_EOF) nread = 0;
  else if (nread == 0) return;

  int err;

  bare_pipe_t *pipe = (bare_pipe_t *) stream;

  if (pipe->exiting) return;

  js_env_t *env = pipe->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, pipe->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_read;
  err = js_get_reference_value(env, pipe->on_read, &on_read);
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
bare_pipe__on_close(uv_handle_t *handle) {
  int err;

  bare_pipe_t *pipe = (bare_pipe_t *) handle;

  js_env_t *env = pipe->env;

  js_deferred_teardown_t *teardown = pipe->teardown;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, pipe->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_close;
  err = js_get_reference_value(env, pipe->on_close, &on_close);
  assert(err == 0);

  err = js_delete_reference(env, pipe->on_connection);
  assert(err == 0);

  err = js_delete_reference(env, pipe->on_connect);
  assert(err == 0);

  err = js_delete_reference(env, pipe->on_write);
  assert(err == 0);

  err = js_delete_reference(env, pipe->on_end);
  assert(err == 0);

  err = js_delete_reference(env, pipe->on_read);
  assert(err == 0);

  err = js_delete_reference(env, pipe->on_close);
  assert(err == 0);

  err = js_delete_reference(env, pipe->ctx);
  assert(err == 0);

  if (!pipe->exiting) js_call_function(env, ctx, on_close, 0, NULL, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  err = js_finish_deferred_teardown_callback(teardown);
  assert(err == 0);
}

static void
bare_pipe__on_teardown(js_deferred_teardown_t *handle, void *data) {
  bare_pipe_t *pipe = (bare_pipe_t *) data;

  pipe->exiting = true;

  if (pipe->closing) return;

  uv_close((uv_handle_t *) &pipe->handle, bare_pipe__on_close);
}

static void
bare_pipe__on_alloc(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
  bare_pipe_t *pipe = (bare_pipe_t *) handle;

  *buf = pipe->read;
}

static js_value_t *
bare_pipe_init(js_env_t *env, js_callback_info_t *info) {
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

  bare_pipe_t *pipe;
  err = js_create_arraybuffer(env, sizeof(bare_pipe_t), (void **) &pipe, &handle);
  assert(err == 0);

  err = uv_pipe_init(loop, &pipe->handle, 0);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  pipe->env = env;
  pipe->closing = false;
  pipe->exiting = false;

  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &pipe->read.base, (size_t *) &pipe->read.len, NULL, NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[1], 1, &pipe->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &pipe->on_connection);
  assert(err == 0);

  err = js_create_reference(env, argv[3], 1, &pipe->on_connect);
  assert(err == 0);

  err = js_create_reference(env, argv[4], 1, &pipe->on_write);
  assert(err == 0);

  err = js_create_reference(env, argv[5], 1, &pipe->on_end);
  assert(err == 0);

  err = js_create_reference(env, argv[6], 1, &pipe->on_read);
  assert(err == 0);

  err = js_create_reference(env, argv[7], 1, &pipe->on_close);
  assert(err == 0);

  err = js_add_deferred_teardown_callback(env, bare_pipe__on_teardown, (void *) pipe, &pipe->teardown);
  assert(err == 0);

  return handle;
}

static js_value_t *
bare_pipe_connect(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  bare_pipe_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_pipe_path_t), NULL);
  assert(err == 0);

  uv_connect_t *req = &pipe->requests.connect;

  req->data = pipe;

  err = uv_pipe_connect2(req, &pipe->handle, (char *) path, strlen((const char *) path), UV_PIPE_NO_TRUNCATE, bare_pipe__on_connect);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_pipe_open(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  err = uv_pipe_open(&pipe->handle, fd);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  uint32_t status = 0;

  if (uv_is_readable((uv_stream_t *) &pipe->handle)) {
    status |= bare_pipe_readable;
  }

  if (uv_is_writable((uv_stream_t *) &pipe->handle)) {
    status |= bare_pipe_writable;
  }

  js_value_t *result;
  err = js_create_uint32(env, status, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_pipe_bind(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  bare_pipe_path_t name;
  err = js_get_value_string_utf8(env, argv[1], name, sizeof(bare_pipe_path_t), NULL);
  assert(err == 0);

  uint32_t backlog;
  err = js_get_value_uint32(env, argv[2], &backlog);
  assert(err == 0);

  err = uv_pipe_bind2(&pipe->handle, (char *) name, strlen((const char *) name), UV_PIPE_NO_TRUNCATE);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  err = uv_listen((uv_stream_t *) &pipe->handle, backlog, bare_pipe__on_connection);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_pipe_accept(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_pipe_t *server;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &server, NULL);
  assert(err == 0);

  bare_pipe_t *client;
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
bare_pipe_writev(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  js_value_t *arr = argv[1];

  uint32_t bufs_len;
  err = js_get_array_length(env, arr, &bufs_len);
  assert(err == 0);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  js_value_t **elements = malloc(bufs_len * sizeof(js_value_t *));

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

  uv_write_t *req = &pipe->requests.write;

  req->data = pipe;

  err = uv_write(req, (uv_stream_t *) &pipe->handle, bufs, bufs_len, bare_pipe__on_write);

  free(bufs);
  free(elements);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_pipe_end(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  uv_shutdown_t *req = &pipe->requests.shutdown;

  req->data = pipe;

  err = uv_shutdown(req, (uv_stream_t *) &pipe->handle, bare_pipe__on_shutdown);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_pipe_resume(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  if (!uv_is_readable((uv_stream_t *) &pipe->handle)) return NULL;

  err = uv_read_start((uv_stream_t *) &pipe->handle, bare_pipe__on_alloc, bare_pipe__on_read);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_pipe_pause(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  if (!uv_is_readable((uv_stream_t *) &pipe->handle)) return NULL;

  err = uv_read_stop((uv_stream_t *) &pipe->handle);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_pipe_close(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  pipe->closing = true;

  uv_close((uv_handle_t *) &pipe->handle, bare_pipe__on_close);

  return NULL;
}

static js_value_t *
bare_pipe_ref(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  uv_ref((uv_handle_t *) &pipe->handle);

  return NULL;
}

static js_value_t *
bare_pipe_unref(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_pipe_t *pipe;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &pipe, NULL);
  assert(err == 0);

  uv_unref((uv_handle_t *) &pipe->handle);

  return NULL;
}

static js_value_t *
bare_pipe_pipe(js_env_t *env, js_callback_info_t *info) {
  int err;

  uv_file fds[2];
  err = uv_pipe(fds, UV_NONBLOCK_PIPE, UV_NONBLOCK_PIPE);
  assert(err == 0);

  js_value_t *result;
  err = js_create_array_with_length(env, 2, &result);
  assert(err == 0);

  js_value_t *read;
  err = js_create_int64(env, fds[0], &read);
  assert(err == 0);

  js_value_t *write;
  err = js_create_int64(env, fds[1], &write);
  assert(err == 0);

  err = js_set_element(env, result, 0, read);
  assert(err == 0);

  err = js_set_element(env, result, 1, write);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_pipe_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("init", bare_pipe_init)
  V("connect", bare_pipe_connect)
  V("open", bare_pipe_open)
  V("bind", bare_pipe_bind)
  V("accept", bare_pipe_accept)
  V("writev", bare_pipe_writev)
  V("end", bare_pipe_end)
  V("resume", bare_pipe_resume)
  V("pause", bare_pipe_pause)
  V("close", bare_pipe_close)
  V("ref", bare_pipe_ref)
  V("unref", bare_pipe_unref)
  V("pipe", bare_pipe_pipe)
#undef V

#define V(name, n) \
  { \
    js_value_t *val; \
    err = js_create_uint32(env, n, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("READABLE", bare_pipe_readable)
  V("WRITABLE", bare_pipe_writable)
#undef V

  return exports;
}

BARE_MODULE(bare_pipe, bare_pipe_exports)
