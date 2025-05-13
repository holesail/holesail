#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdlib.h>
#include <uv.h>

typedef struct {
  uv_tty_t handle;

  struct {
    uv_write_t write;
    uv_shutdown_t shutdown;
  } requests;

  uv_buf_t read;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_write;
  js_ref_t *on_read;
  js_ref_t *on_close;

  bool closing;
  bool exiting;

  js_deferred_teardown_t *teardown;
} bare_tty_t;

static void
bare_tty__on_write(uv_write_t *req, int status) {
  int err;

  bare_tty_t *tty = (bare_tty_t *) req->data;

  if (tty->exiting) return;

  js_env_t *env = tty->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tty->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_write;
  err = js_get_reference_value(env, tty->on_write, &on_write);
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
bare_tty__on_read(uv_stream_t *stream, ssize_t nread, const uv_buf_t *buf) {
  if (nread == UV_EOF) nread = 0;
  else if (nread == 0) return;

  int err;

  bare_tty_t *tty = (bare_tty_t *) stream;

  if (tty->exiting) return;

  js_env_t *env = tty->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tty->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_read;
  err = js_get_reference_value(env, tty->on_read, &on_read);
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
bare_tty__on_close(uv_handle_t *handle) {
  int err;

  bare_tty_t *tty = (bare_tty_t *) handle;

  js_env_t *env = tty->env;

  js_deferred_teardown_t *teardown = tty->teardown;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, tty->ctx, &ctx);
  assert(err == 0);

  js_value_t *callback;
  err = js_get_reference_value(env, tty->on_close, &callback);
  assert(err == 0);

  err = js_delete_reference(env, tty->on_write);
  assert(err == 0);

  err = js_delete_reference(env, tty->on_read);
  assert(err == 0);

  err = js_delete_reference(env, tty->on_close);
  assert(err == 0);

  err = js_delete_reference(env, tty->ctx);
  assert(err == 0);

  if (!tty->exiting) js_call_function(env, ctx, callback, 0, NULL, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  err = js_finish_deferred_teardown_callback(teardown);
  assert(err == 0);
}

static void
bare_tty__on_teardown(js_deferred_teardown_t *handle, void *data) {
  bare_tty_t *tty = (bare_tty_t *) data;

  tty->exiting = true;

  if (tty->closing) return;

  uv_close((uv_handle_t *) &tty->handle, bare_tty__on_close);
}

static void
bare_tty__on_alloc(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
  bare_tty_t *tty = (bare_tty_t *) handle;

  *buf = tty->read;
}

static js_value_t *
bare_tty_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 6;
  js_value_t *argv[6];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 6);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  js_value_t *handle;

  bare_tty_t *tty;
  err = js_create_arraybuffer(env, sizeof(bare_tty_t), (void **) &tty, &handle);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  err = uv_tty_init(loop, &tty->handle, fd, 1);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  err = uv_stream_set_blocking((uv_stream_t *) &tty->handle, true);

  // Not all platforms support blocking TTY handles.
  (void) err;

  tty->env = env;
  tty->closing = false;
  tty->exiting = false;

  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &tty->read.base, (size_t *) &tty->read.len, NULL, NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &tty->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[3], 1, &tty->on_write);
  assert(err == 0);

  err = js_create_reference(env, argv[4], 1, &tty->on_read);
  assert(err == 0);

  err = js_create_reference(env, argv[5], 1, &tty->on_close);
  assert(err == 0);

  err = js_add_deferred_teardown_callback(env, bare_tty__on_teardown, (void *) tty, &tty->teardown);
  assert(err == 0);

  return handle;
}

static js_value_t *
bare_tty_writev(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_tty_t *tty;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tty, NULL);
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

  uv_write_t *req = &tty->requests.write;

  req->data = tty;

  err = uv_write(req, (uv_stream_t *) &tty->handle, bufs, bufs_len, bare_tty__on_write);

  free(bufs);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tty_resume(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tty_t *tty;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tty, NULL);
  assert(err == 0);

  err = uv_read_start((uv_stream_t *) &tty->handle, bare_tty__on_alloc, bare_tty__on_read);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tty_pause(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tty_t *tty;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tty, NULL);
  assert(err == 0);

  err = uv_read_stop((uv_stream_t *) &tty->handle);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tty_close(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tty_t *tty;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tty, NULL);
  assert(err == 0);

  err = uv_tty_set_mode(&tty->handle, UV_TTY_MODE_NORMAL);

  // Resetting the mode won't always work, in particular on Windows when we
  // close an output stream.
  (void) err;

  tty->closing = true;

  uv_close((uv_handle_t *) &tty->handle, bare_tty__on_close);

  return NULL;
}

static js_value_t *
bare_tty_set_mode(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_tty_t *tty;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tty, NULL);
  assert(err == 0);

  uint32_t mode;
  err = js_get_value_uint32(env, argv[1], &mode);
  assert(err == 0);

  err = uv_tty_set_mode(&tty->handle, mode);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_tty_get_window_size(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tty_t *tty;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &tty, NULL);
  assert(err == 0);

  int width, height;
  err = uv_tty_get_winsize(&tty->handle, &width, &height);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  js_value_t *result;
  err = js_create_array_with_length(env, 2, &result);
  assert(err == 0);

  js_value_t *value;

  err = js_create_int32(env, width, &value);
  assert(err == 0);

  err = js_set_element(env, result, 0, value);
  assert(err == 0);

  err = js_create_int32(env, height, &value);
  assert(err == 0);

  err = js_set_element(env, result, 1, value);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_tty_is_tty(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  int32_t fd;
  err = js_get_value_int32(env, argv[0], &fd);
  assert(err == 0);

  js_value_t *result;
  err = js_get_boolean(env, uv_guess_handle(fd) == UV_TTY, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_tty_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("init", bare_tty_init)
  V("writev", bare_tty_writev)
  V("resume", bare_tty_resume)
  V("pause", bare_tty_pause)
  V("close", bare_tty_close)
  V("setMode", bare_tty_set_mode)
  V("getWindowSize", bare_tty_get_window_size)
  V("isTTY", bare_tty_is_tty)
#undef V

#define V(name, n) \
  { \
    js_value_t *val; \
    err = js_create_uint32(env, n, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("MODE_NORMAL", UV_TTY_MODE_NORMAL)
  V("MODE_RAW", UV_TTY_MODE_RAW)
#ifndef _WIN32
  V("MODE_IO", UV_TTY_MODE_IO)
#endif
#undef V

  return exports;
}

BARE_MODULE(bare_tty, bare_tty_exports)
