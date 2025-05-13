#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <utf.h>
#include <uv.h>

typedef struct {
  uv_getaddrinfo_t handle;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *cb;

  bool all;
  bool exiting;

  js_deferred_teardown_t *teardown;
} bare_dns_lookup_t;

static void
bare_dns__on_lookup(uv_getaddrinfo_t *handle, int status, struct addrinfo *res) {
  int err;

  bare_dns_lookup_t *req = (bare_dns_lookup_t *) handle;

  js_env_t *env = req->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, req->ctx, &ctx);
  assert(err == 0);

  js_value_t *cb;
  err = js_get_reference_value(env, req->cb, &cb);
  assert(err == 0);

  err = js_delete_reference(env, req->cb);
  assert(err == 0);

  err = js_delete_reference(env, req->ctx);
  assert(err == 0);

  js_value_t *args[2];

  if (status < 0) {
    js_value_t *code;
    err = js_create_string_utf8(env, (utf8_t *) uv_err_name(status), -1, &code);
    assert(err == 0);

    js_value_t *message;
    err = js_create_string_utf8(env, (utf8_t *) uv_strerror(status), -1, &message);
    assert(err == 0);

    err = js_create_error(env, code, message, &args[0]);
    assert(err == 0);

    err = js_get_null(env, &args[1]);
    assert(err == 0);
  } else {
    err = js_get_null(env, &args[0]);
    assert(err == 0);

    js_value_t *result;
    err = js_create_array(env, &result);
    assert(err == 0);

    uint32_t i = 0;

    for (struct addrinfo *next = res; next != NULL; next = next->ai_next) {
      assert(next->ai_socktype == SOCK_STREAM);

      int family;

      char ip[INET6_ADDRSTRLEN];

      if (next->ai_family == AF_INET) {
        family = 4;
        err = uv_ip4_name((struct sockaddr_in *) next->ai_addr, ip, sizeof(ip));
      } else if (next->ai_family == AF_INET6) {
        family = 6;
        err = uv_ip6_name((struct sockaddr_in6 *) next->ai_addr, ip, sizeof(ip));
      } else {
        continue;
      }

      assert(err == 0);

      js_value_t *address;
      err = js_create_object(env, &address);
      assert(err == 0);

      err = js_set_element(env, result, i++, address);
      assert(err == 0);

      js_value_t *value;

      err = js_create_string_utf8(env, (utf8_t *) ip, -1, &value);
      assert(err == 0);

      err = js_set_named_property(env, address, "address", value);
      assert(err == 0);

      err = js_create_uint32(env, family, &value);
      assert(err == 0);

      err = js_set_named_property(env, address, "family", value);
      assert(err == 0);

      if (!req->all) break;
    }

    if (i > 0) args[1] = result;
    else {
      js_value_t *code;
      err = js_create_string_utf8(env, (utf8_t *) uv_err_name(UV_EAI_NODATA), -1, &code);
      assert(err == 0);

      js_value_t *message;
      err = js_create_string_utf8(env, (utf8_t *) uv_strerror(UV_EAI_NODATA), -1, &message);
      assert(err == 0);

      err = js_create_error(env, code, message, &args[0]);
      assert(err == 0);

      err = js_get_null(env, &args[1]);
      assert(err == 0);
    }
  }

  uv_freeaddrinfo(res);

  if (!req->exiting) js_call_function(req->env, ctx, cb, 2, args, NULL);

  err = js_close_handle_scope(req->env, scope);
  assert(err == 0);

  err = js_finish_deferred_teardown_callback(req->teardown);
  assert(err == 0);
}

static void
bare_dns__on_teardown(js_deferred_teardown_t *handle, void *data) {
  bare_dns_lookup_t *req = (bare_dns_lookup_t *) data;

  req->exiting = true;

  uv_cancel((uv_req_t *) &req->handle);
}

static js_value_t *
bare_dns_lookup(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  size_t len;
  err = js_get_value_string_utf8(env, argv[0], NULL, 0, &len);
  assert(err == 0);

  len += 1 /* NULL */;

  utf8_t *hostname = malloc(len);
  err = js_get_value_string_utf8(env, argv[0], hostname, len, NULL);
  assert(err == 0);

  uint32_t family;
  err = js_get_value_uint32(env, argv[1], &family);
  assert(err == 0);

  bool all;
  err = js_get_value_bool(env, argv[2], &all);
  assert(err == 0);

  struct addrinfo hints = {
    .ai_family = family == 4
                   ? AF_INET
                 : family == 6 ? AF_INET6
                               : AF_UNSPEC,
    .ai_socktype = SOCK_STREAM,
    .ai_flags = 0,
  };

  js_value_t *handle;

  bare_dns_lookup_t *req;
  err = js_create_arraybuffer(env, sizeof(bare_dns_lookup_t), (void **) &req, &handle);
  assert(err == 0);

  req->env = env;
  req->all = all;
  req->exiting = false;

  err = js_create_reference(env, argv[3], 1, &req->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[4], 1, &req->cb);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  err = uv_getaddrinfo(loop, &req->handle, bare_dns__on_lookup, (const char *) hostname, NULL, &hints);

  free(hostname);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  err = js_add_deferred_teardown_callback(env, bare_dns__on_teardown, (void *) req, &req->teardown);
  assert(err == 0);

  return handle;
}

static js_value_t *
bare_dns_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("lookup", bare_dns_lookup)
#undef V

  return exports;
}

BARE_MODULE(bare_dns, bare_dns_exports)
