#include <assert.h>
#include <bare.h>
#include <js.h>
#include <uv.h>

typedef struct {
  uv_signal_t handle;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_signal;
  js_ref_t *on_close;

  bool closing;
  bool exiting;

  js_deferred_teardown_t *teardown;
} bare_signal_t;

static void
bare_signals__on_signal(uv_signal_t *handle, int signum) {
  int err;

  bare_signal_t *signal = (bare_signal_t *) handle;

  if (signal->exiting) return;

  js_env_t *env = signal->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *on_signal;
  err = js_get_reference_value(env, signal->on_signal, &on_signal);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, signal->ctx, &ctx);
  assert(err == 0);

  js_call_function(env, ctx, on_signal, 0, NULL, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_signals__on_close(uv_handle_t *handle) {
  int err;

  bare_signal_t *signal = (bare_signal_t *) handle;

  js_env_t *env = signal->env;

  js_deferred_teardown_t *teardown = signal->teardown;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *on_close;
  err = js_get_reference_value(env, signal->on_close, &on_close);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, signal->ctx, &ctx);
  assert(err == 0);

  err = js_delete_reference(env, signal->on_signal);
  assert(err == 0);

  err = js_delete_reference(env, signal->on_close);
  assert(err == 0);

  err = js_delete_reference(env, signal->ctx);
  assert(err == 0);

  if (!signal->exiting) js_call_function(env, ctx, on_close, 0, NULL, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  err = js_finish_deferred_teardown_callback(teardown);
  assert(err == 0);
}

static void
bare_signals__on_teardown(js_deferred_teardown_t *handle, void *data) {
  bare_signal_t *signal = (bare_signal_t *) data;

  signal->exiting = true;

  if (signal->closing) return;

  uv_close((uv_handle_t *) &signal->handle, bare_signals__on_close);
}

static js_value_t *
bare_signals_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  js_value_t *handle;

  bare_signal_t *signal;
  err = js_create_arraybuffer(env, sizeof(bare_signal_t), (void **) &signal, &handle);
  if (err < 0) return NULL;

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  err = uv_signal_init(loop, &signal->handle);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  signal->env = env;
  signal->closing = false;
  signal->exiting = false;

  err = js_create_reference(env, argv[0], 1, &signal->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[1], 1, &signal->on_signal);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &signal->on_close);
  assert(err == 0);

  err = js_add_deferred_teardown_callback(env, bare_signals__on_teardown, (void *) signal, &signal->teardown);
  assert(err == 0);

  return handle;
}

static js_value_t *
bare_signals_close(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_signal_t *signal;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &signal, NULL);
  assert(err == 0);

  signal->closing = true;

  uv_close((uv_handle_t *) &signal->handle, bare_signals__on_close);

  return NULL;
}

static js_value_t *
bare_signals_start(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_signal_t *signal;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &signal, NULL);
  assert(err == 0);

  int32_t signum;
  err = js_get_value_int32(env, argv[1], &signum);
  assert(err == 0);

  err = uv_signal_start(&signal->handle, bare_signals__on_signal, signum);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_signals_stop(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_signal_t *signal;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &signal, NULL);
  assert(err == 0);

  err = uv_signal_stop(&signal->handle);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
bare_signals_ref(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_signal_t *signal;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &signal, NULL);
  assert(err == 0);

  uv_ref((uv_handle_t *) &signal->handle);

  return NULL;
}

static js_value_t *
bare_signals_unref(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_signal_t *signal;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &signal, NULL);
  assert(err == 0);

  uv_unref((uv_handle_t *) &signal->handle);

  return NULL;
}

static js_value_t *
bare_signals_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("init", bare_signals_init)
  V("close", bare_signals_close)
  V("start", bare_signals_start)
  V("stop", bare_signals_stop)
  V("ref", bare_signals_ref)
  V("unref", bare_signals_unref)
#undef V

  return exports;
}

BARE_MODULE(bare_signals, bare_signals_exports)
