#include <assert.h>
#include <bare.h>
#include <js.h>
#include <uv.h>

#include "lex.h"

static js_value_t *
bare_module_lexer_lex(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  utf8_t *input;
  size_t len;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &input, (size_t *) &len, NULL, NULL);
  assert(err == 0);

  js_value_t *imports;
  err = js_create_array(env, &imports);
  assert(err == 0);

  js_value_t *exports;
  err = js_create_array(env, &exports);
  assert(err == 0);

  err = bare_module_lexer__lex(env, imports, exports, input, len);
  if (err < 0) return NULL;

  js_value_t *result;
  err = js_create_object(env, &result);
  assert(err == 0);

  err = js_set_named_property(env, result, "imports", imports);
  assert(err == 0);

  err = js_set_named_property(env, result, "exports", exports);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_module_lexer_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("lex", bare_module_lexer_lex)
#undef V

#define V(name, n) \
  { \
    js_value_t *val; \
    err = js_create_uint32(env, n, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("REQUIRE", bare_module_lexer_require)
  V("IMPORT", bare_module_lexer_import)
  V("DYNAMIC", bare_module_lexer_dynamic)
  V("ADDON", bare_module_lexer_addon)
  V("ASSET", bare_module_lexer_asset)
  V("RESOLVE", bare_module_lexer_resolve)
  V("REEXPORT", bare_module_lexer_reexport)
#undef V

  return exports;
}

BARE_MODULE(bare_module_lexer, bare_module_lexer_exports)
