#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <utf.h>
#include <uv.h>

typedef struct {
  js_ref_t *ctx;
  js_ref_t *on_import;
  js_ref_t *on_evaluate;
  js_ref_t *on_meta;
} bare_module_context_t;

static js_module_t *
bare_module__on_static_import(js_env_t *env, js_value_t *specifier, js_value_t *assertions, js_module_t *referrer, void *data) {
  bare_module_context_t *context = (bare_module_context_t *) data;

  int err;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, context->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_import;
  err = js_get_reference_value(env, context->on_import, &on_import);
  assert(err == 0);

  const char *name;
  err = js_get_module_name(env, referrer, &name);
  assert(err == 0);

  js_value_t *args[4] = {specifier, assertions};

  err = js_create_string_utf8(env, (utf8_t *) name, -1, &args[2]);
  if (err < 0) goto err;

  err = js_get_boolean(env, false, &args[3]);
  assert(err == 0);

  js_value_t *result;
  err = js_call_function(env, ctx, on_import, 4, args, &result);
  if (err < 0) goto err;

  js_module_t *module;
  err = js_get_value_external(env, result, (void **) &module);
  if (err < 0) goto err;

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  return module;

err:
  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  return NULL;
}

static js_module_t *
bare_module__on_dynamic_import(js_env_t *env, js_value_t *specifier, js_value_t *assertions, js_value_t *referrer, void *data) {
  bare_module_context_t *context = (bare_module_context_t *) data;

  int err;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, context->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_import;
  err = js_get_reference_value(env, context->on_import, &on_import);
  assert(err == 0);

  js_value_t *args[4] = {specifier, assertions, referrer};

  err = js_get_boolean(env, true, &args[3]);
  assert(err == 0);

  js_value_t *result;
  err = js_call_function(env, ctx, on_import, 4, args, &result);
  if (err < 0) goto err;

  js_module_t *module;
  err = js_get_value_external(env, result, (void **) &module);
  if (err < 0) goto err;

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  return module;

err:
  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  return NULL;
}

static void
bare_module__on_evaluate(js_env_t *env, js_module_t *module, void *data) {
  bare_module_context_t *context = (bare_module_context_t *) data;

  int err;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, context->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_evaluate;
  err = js_get_reference_value(env, context->on_evaluate, &on_evaluate);
  assert(err == 0);

  const char *name;
  err = js_get_module_name(env, module, &name);
  assert(err == 0);

  js_value_t *args[1];

  err = js_create_string_utf8(env, (utf8_t *) name, -1, &args[0]);
  if (err < 0) goto err;

  js_value_t *result;
  err = js_call_function(env, ctx, on_evaluate, 1, args, &result);
  if (err < 0) goto err;

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  return;

err:
  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_module__on_meta(js_env_t *env, js_module_t *module, js_value_t *meta, void *data) {
  bare_module_context_t *context = (bare_module_context_t *) data;

  int err;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, context->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_meta;
  err = js_get_reference_value(env, context->on_meta, &on_meta);
  assert(err == 0);

  const char *name;
  err = js_get_module_name(env, module, &name);
  assert(err == 0);

  js_value_t *args[2];

  err = js_create_string_utf8(env, (utf8_t *) name, -1, &args[0]);
  if (err < 0) goto err;

  args[1] = meta;

  js_value_t *result;
  err = js_call_function(env, ctx, on_meta, 2, args, &result);
  if (err < 0) goto err;

  err = js_close_handle_scope(env, scope);
  assert(err == 0);

  return;

err:
  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static js_value_t *
bare_module_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_module_context_t *context;

  js_value_t *result;
  err = js_create_unsafe_arraybuffer(env, sizeof(bare_module_context_t), (void **) &context, &result);
  if (err < 0) return NULL;

  err = js_create_reference(env, argv[0], 1, &context->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[1], 1, &context->on_import);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &context->on_evaluate);
  assert(err == 0);

  err = js_create_reference(env, argv[3], 1, &context->on_meta);
  assert(err == 0);

  err = js_on_dynamic_import(env, bare_module__on_dynamic_import, (void *) context);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_module_destroy(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_module_context_t *context;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &context, NULL);
  if (err < 0) return NULL;

  err = js_delete_reference(env, context->on_import);
  assert(err == 0);

  err = js_delete_reference(env, context->on_evaluate);
  assert(err == 0);

  err = js_delete_reference(env, context->on_meta);
  assert(err == 0);

  err = js_delete_reference(env, context->ctx);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_module_create_function(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  size_t file_len;
  utf8_t file[1024];
  err = js_get_value_string_utf8(env, argv[0], file, 1024, &file_len);
  if (err < 0) return NULL;

  uint32_t args_len;
  err = js_get_array_length(env, argv[1], &args_len);
  if (err < 0) return NULL;

  js_value_t **args = malloc(sizeof(js_value_t *) * args_len);

  uint32_t fetched;
  err = js_get_array_elements(env, argv[1], args, args_len, 0, &fetched);

  if (err < 0 || fetched != args_len) {
    goto err;
  }

  js_value_t *source = argv[2];

  int32_t offset;
  err = js_get_value_int32(env, argv[3], &offset);
  if (err < 0) goto err;

  js_value_t *result;
  err = js_create_function_with_source(env, NULL, 0, (char *) file, file_len, args, args_len, 0, source, &result);
  if (err < 0) goto err;

  free(args);

  return result;

err:
  free(args);

  return NULL;
}

static js_value_t *
bare_module_create_module(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  size_t file_len;
  utf8_t file[1024];
  err = js_get_value_string_utf8(env, argv[0], file, 1024, &file_len);
  if (err < 0) return NULL;

  js_value_t *source = argv[1];

  int32_t offset;
  err = js_get_value_int32(env, argv[2], &offset);
  if (err < 0) return NULL;

  bare_module_context_t *context;
  err = js_get_arraybuffer_info(env, argv[3], (void **) &context, NULL);
  if (err < 0) return NULL;

  js_module_t *module;
  err = js_create_module(env, (char *) file, file_len, offset, source, bare_module__on_meta, (void *) context, &module);
  if (err < 0) return NULL;

  js_value_t *result;
  err = js_create_external(env, (void *) module, NULL, NULL, &result);
  if (err < 0) return NULL;

  return result;
}

static js_value_t *
bare_module_create_synthetic_module(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  size_t file_len;
  utf8_t file[1024];
  err = js_get_value_string_utf8(env, argv[0], file, 1024, &file_len);
  if (err < 0) return NULL;

  uint32_t names_len;
  err = js_get_array_length(env, argv[1], &names_len);
  if (err < 0) return NULL;

  js_value_t **export_names = malloc(sizeof(js_value_t *) * names_len);

  uint32_t fetched;
  err = js_get_array_elements(env, argv[1], export_names, names_len, 0, &fetched);

  if (err < 0 || fetched != names_len) {
    goto err;
  }

  bare_module_context_t *context;
  err = js_get_arraybuffer_info(env, argv[2], (void **) &context, NULL);
  if (err < 0) goto err;

  js_module_t *module;
  err = js_create_synthetic_module(env, (char *) file, file_len, export_names, names_len, bare_module__on_evaluate, (void *) context, &module);
  if (err < 0) goto err;

  js_value_t *result;
  err = js_create_external(env, (void *) module, NULL, NULL, &result);
  if (err < 0) goto err;

  free(export_names);

  return result;

err:
  free(export_names);

  return NULL;
}

static js_value_t *
bare_module_delete_module(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  js_module_t *module;
  err = js_get_value_external(env, argv[0], (void **) &module);
  if (err < 0) return NULL;

  err = js_delete_module(env, module);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_module_set_export(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  js_module_t *module;
  err = js_get_value_external(env, argv[0], (void **) &module);
  if (err < 0) return NULL;

  js_set_module_export(env, module, argv[1], argv[2]);

  return NULL;
}

static js_value_t *
bare_module_run_module(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  js_module_t *module;
  err = js_get_value_external(env, argv[0], (void **) &module);
  if (err < 0) return NULL;

  bare_module_context_t *context;
  err = js_get_arraybuffer_info(env, argv[1], (void **) &context, NULL);
  if (err < 0) return NULL;

  err = js_instantiate_module(env, module, bare_module__on_static_import, (void *) context);
  if (err < 0) return NULL;

  js_value_t *promise;
  err = js_run_module(env, module, &promise);
  if (err < 0) return NULL;

  bool is_promise;
  err = js_is_promise(env, promise, &is_promise);
  assert(err == 0);

  if (is_promise) {
    js_promise_state_t state;
    err = js_get_promise_state(env, promise, &state);
    assert(err == 0);

    js_value_t *reason;

    if (state == js_promise_rejected) {
      err = js_get_promise_result(env, promise, &reason);
      if (err < 0) return NULL;
    } else {
      err = js_get_null(env, &reason);
      assert(err == 0);
    }

    js_value_t *exception;
    err = js_get_and_clear_last_exception(env, &exception);
    assert(err == 0);

    js_value_t *ctx;
    err = js_get_reference_value(env, context->ctx, &ctx);
    assert(err == 0);

    js_value_t *args[3] = {reason, promise, exception};

    js_call_function(env, ctx, argv[2], 3, args, NULL);
  }

  return NULL;
}

static js_value_t *
bare_module_get_namespace(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  js_module_t *module;
  err = js_get_value_external(env, argv[0], (void **) &module);
  if (err < 0) return NULL;

  js_value_t *result;
  err = js_get_module_namespace(env, module, &result);
  if (err < 0) return NULL;

  return result;
}

static js_value_t *
bare_module_exists(js_env_t *env, js_callback_info_t *info) {
  int err;

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  js_value_t *argv[2];
  size_t argc = 2;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  utf8_t path[4096];
  err = js_get_value_string_utf8(env, argv[0], path, 4096, NULL);
  assert(err == 0);

  uint32_t mode;
  err = js_get_value_uint32(env, argv[1], &mode);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_stat(loop, &req, (char *) path, NULL);

  uv_stat_t *st = req.result < 0 ? NULL : req.ptr;

  js_value_t *result;
  err = js_get_boolean(env, st && st->st_mode & mode, &result);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return result;
}

static js_value_t *
bare_module_realpath(js_env_t *env, js_callback_info_t *info) {
  int err;

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  js_value_t *argv[1];
  size_t argc = 1;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  utf8_t path[4096];
  err = js_get_value_string_utf8(env, argv[0], path, 4096, NULL);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_realpath(loop, &req, (char *) path, NULL);

  int res = req.result;

  if (res < 0) {
    uv_fs_req_cleanup(&req);
    err = res;
    goto err;
  }

  js_value_t *result;
  err = js_create_string_utf8(env, (utf8_t *) req.ptr, -1, &result);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return result;

err:
  js_throw_error(env, uv_err_name(err), uv_strerror(err));

  return NULL;
}

static js_value_t *
bare_module_read(js_env_t *env, js_callback_info_t *info) {
  int err;

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  js_value_t *argv[1];
  size_t argc = 1;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  utf8_t path[4096];
  err = js_get_value_string_utf8(env, argv[0], path, 4096, NULL);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_open(loop, &req, (char *) path, UV_FS_O_RDONLY, 0, NULL);

  int fd = req.result;
  uv_fs_req_cleanup(&req);

  if (fd < 0) {
    err = fd;
    goto err;
  }

  uv_fs_fstat(loop, &req, fd, NULL);
  uv_stat_t *st = req.ptr;

  size_t len = st->st_size;
  char *base;

  js_value_t *result;
  err = js_create_arraybuffer(env, len, (void **) &base, &result);
  assert(err == 0);

  uv_buf_t buffer = uv_buf_init(base, len);

  uv_fs_req_cleanup(&req);

  int64_t read = 0;

  while (true) {
    uv_fs_read(loop, &req, fd, &buffer, 1, read, NULL);

    int res = req.result;
    uv_fs_req_cleanup(&req);

    if (res < 0) {
      uv_fs_close(loop, &req, fd, NULL);
      uv_fs_req_cleanup(&req);
      err = res;
      goto err;
    }

    buffer.base += res;
    buffer.len -= res;

    read += res;
    if (res == 0 || read == len) break;
  }

  uv_fs_close(loop, &req, fd, NULL);
  uv_fs_req_cleanup(&req);

  return result;

err:
  js_throw_error(env, uv_err_name(err), uv_strerror(err));

  return NULL;
}

static js_value_t *
bare_module_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("init", bare_module_init)
  V("destroy", bare_module_destroy)

  V("createFunction", bare_module_create_function)
  V("createModule", bare_module_create_module)
  V("createSyntheticModule", bare_module_create_synthetic_module)
  V("deleteModule", bare_module_delete_module)
  V("setExport", bare_module_set_export)
  V("runModule", bare_module_run_module)
  V("getNamespace", bare_module_get_namespace)

  V("exists", bare_module_exists)
  V("realpath", bare_module_realpath)
  V("read", bare_module_read)
#undef V

#define V(name, n) \
  { \
    js_value_t *val; \
    err = js_create_uint32(env, n, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("FILE", S_IFREG)
  V("DIR", S_IFDIR)
#undef V

  return exports;
}

BARE_MODULE(bare_module, bare_module_exports)
