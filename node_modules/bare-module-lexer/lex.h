#ifndef BARE_MODULE_LEXER_H
#define BARE_MODULE_LEXER_H

#include <assert.h>
#include <js.h>
#include <stdbool.h>
#include <stddef.h>
#include <string.h>
#include <utf.h>

enum {
  bare_module_lexer_require = 0x1,
  bare_module_lexer_import = 0x2,
  bare_module_lexer_dynamic = 0x4,
  bare_module_lexer_addon = 0x8,
  bare_module_lexer_asset = 0x10,
  bare_module_lexer_resolve = 0x20,
  bare_module_lexer_reexport = 0x40,
};

static inline bool
bare_module_lexer__is_line_terminator(uint8_t c) {
  return c == 0xa || c == 0xd;
}

static inline bool
bare_module_lexer__is_whitespace(uint8_t c) {
  return c == ' ' || c == '\t' || c == 0xb || c == 0xc || c == 0xa0 || bare_module_lexer__is_line_terminator(c);
}

static inline bool
bare_module_lexer__is_id_start(uint8_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || c == '$';
}

static inline bool
bare_module_lexer__is_id(uint8_t c) {
  return bare_module_lexer__is_id_start(c) || (c >= '0' && c <= '9');
}

static inline int
bare_module_lexer__add_position(js_env_t *env, js_value_t *entry, size_t statement_start, size_t input_start, size_t input_end) {
  int err;

  js_value_t *position;
  err = js_create_array_with_length(env, 3, &position);
  assert(err == 0);

#define V(i, n) \
  { \
    js_value_t *val; \
    err = js_create_int64(env, n, &val); \
    assert(err == 0); \
    err = js_set_element(env, position, i, val); \
    assert(err == 0); \
  }

  V(0, statement_start);
  V(1, input_start);
  V(2, input_end);
#undef V

  err = js_set_named_property(env, entry, "position", position);
  assert(err == 0);

  return 0;
}

static inline int
bare_module_lexer__add_import(js_env_t *env, js_value_t *imports, uint32_t *i, const utf8_t *source, size_t import_start, size_t specifier_start, size_t specifier_end, int type, js_value_t *names) {
  assert(specifier_end >= specifier_start);

  int err;

  js_value_t *entry;
  err = js_create_object(env, &entry);
  assert(err == 0);

  err = js_set_element(env, imports, *i, entry);
  assert(err == 0);

#define V(key, fn, ...) \
  { \
    js_value_t *val; \
    err = fn(env, __VA_ARGS__, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, entry, key, val); \
    assert(err == 0); \
  }

  V("specifier", js_create_string_utf8, &source[specifier_start], specifier_end - specifier_start);
  V("type", js_create_uint32, type);
#undef V

  if (names == NULL) {
    err = js_create_array(env, &names);
    assert(err == 0);
  }

  err = js_set_named_property(env, entry, "names", names);
  assert(err == 0);

  err = bare_module_lexer__add_position(env, entry, import_start, specifier_start, specifier_end);
  assert(err == 0);

  *i += 1;

  return 0;
}

static inline int
bare_module_lexer__add_export(js_env_t *env, js_value_t *exports, uint32_t *i, const utf8_t *source, size_t export_start, size_t name_start, size_t name_end) {
  assert(name_end >= name_start);

  int err;

  js_value_t *entry;
  err = js_create_object(env, &entry);
  assert(err == 0);

  err = js_set_element(env, exports, *i, entry);
  assert(err == 0);

#define V(key, fn, ...) \
  { \
    js_value_t *val; \
    err = fn(env, __VA_ARGS__, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, entry, key, val); \
    assert(err == 0); \
  }

  V("name", js_create_string_utf8, &source[name_start], name_end - name_start);
#undef V

  err = bare_module_lexer__add_position(env, entry, export_start, name_start, name_end);
  assert(err == 0);

  *i += 1;

  return 0;
}

static inline int
bare_module_lexer__add_name(js_env_t *env, js_value_t **names, uint32_t *i, const utf8_t *name) {
  int err;

  if (*names == NULL) {
    err = js_create_array(env, names);
    assert(err == 0);

    *i = 0;
  }

  js_value_t *string;
  err = js_create_string_utf8(env, name, -1, &string);
  assert(err == 0);

  err = js_set_element(env, *names, *i, string);
  assert(err == 0);

  *i += 1;

  return 0;
}

static inline int
bare_module_lexer__lex(js_env_t *env, js_value_t *imports, js_value_t *exports, const utf8_t *s, size_t n) {
  int err;

  size_t i = 0;

  size_t is;       // Import start
  uint32_t il = 0; // Import count

  size_t es;       // Export start
  uint32_t el = 0; // Export count

  size_t ss; // Source start
  size_t se; // Source end

  int type;

  js_value_t *names;
  uint32_t nl; // Names count

// Current character, unchecked
#define u(offset) ((uint8_t) s[i + offset])

// Current character, checked
#define c(offset) (i + offset < n ? u(offset) : -1)

// Begins with string, unchecked
#define bu(t, l) (strncmp((const char *) &s[i], t, l) == 0)

// Begins with string, checked
#define bc(t, l) (i + l < n && bu(t, l))

#define lt  bare_module_lexer__is_line_terminator
#define ws  bare_module_lexer__is_whitespace
#define ids bare_module_lexer__is_id_start
#define id  bare_module_lexer__is_id

  while (i < n) {
    while (i < n && ws(u(0))) i++;

    if (i + 7 >= n) break;

    if (bu("//", 2)) {
      i += 2;

      while (i < n && !lt(u(0))) i++;

      if (lt(c(0))) i++;

      continue;
    }

    if (bu("/*", 2)) {
      i += 2;

      while (i + 1 < n && !bu("*/", 2)) i++;

      if (bc("/*", 2)) i += 2;

      continue;
    }

    if (u(0) == '\'' || u(0) == '"' || u(0) == '`') {
      utf8_t e = u(0);

      i++;

      while (i < n) {
        if (u(0) == '\\') i += 2;
        else if (u(0) != e) i++;
        else break;
      }

      if (c(0) == e) i++;

      continue;
    }

    type = 0;
    names = NULL;

    if (bu("require", 7)) {
      is = i;

      i += 7;

      goto require;
    }

    else if (bu("import", 6)) {
      is = i;

      i += 6;

      type |= bare_module_lexer_import;

      while (i < n && ws(u(0))) i++;

      // import \*
      if (c(0) == '*') {
        i++;

        while (i < n && ws(u(0))) i++;

        // import \* as
        if (i + 3 < n && bu("as", 2) && ws(u(2))) {
          i += 3;

          while (i < n && ws(u(0))) i++;

          // import \* as [^\s]+
          while (i < n && !ws(u(0))) i++;

          while (i < n && ws(u(0))) i++;

          // import \* as [^\s]+ from
          if (bc("from", 4)) {
            i += 4;

            err = bare_module_lexer__add_name(env, &names, &nl, (const utf8_t *) "*");
            assert(err == 0);

            goto from;
          }
        }
      }

      // import {
      else if (c(0) == '{') {
        i++;

        // import {[^}]*
        while (i < n && u(0) != '}') i++;

        // import {[^}]*}
        if (c(0) == '}') {
          i++;

          while (i < n && ws(u(0))) i++;

          // import {[^}]*} from
          if (bc("from", 4)) {
            i += 4;

            goto from;
          }
        }
      }

      // import ['"]
      else if (c(0) == '\'' || c(0) == '"') {
        utf8_t e = u(0);

        ss = ++i;

        while (i < n && u(0) != e) i++;

        // import ['"].*['"]
        if (c(0) == e) {
          se = i;

          i++;

          err = bare_module_lexer__add_import(env, imports, &il, s, is, ss, se, type, names);
          if (err < 0) goto err;
        }
      }

      // import\(
      else if (c(0) == '(') {
        type |= bare_module_lexer_dynamic;

        i++;

        while (i < n && ws(u(0))) i++;

        // import\(['"]
        if (c(0) == '\'' || c(0) == '"') {
          utf8_t e = u(0);

          ss = ++i;

          while (i < n && u(0) != e) i++;

          // import\(['"].*['"]
          if (c(0) == e) {
            se = i;

            i++;

            while (i < n && ws(u(0))) i++;

            while (i < n && u(0) != ')') i++;

            // import\(['"].*['"][^)]*\)
            if (c(0) == ')') {
              i++;

              err = bare_module_lexer__add_import(env, imports, &il, s, is, ss, se, type, names);
              if (err < 0) goto err;
            }
          }
        }
      }

      // import\s
      else if (ws(c(-1))) {
        size_t j = i;

        while (i < n && !ws(u(0))) i++;

        // import [^\s]+
        if (j < i) {
          while (i < n && ws(u(0))) i++;

          // import [^\s]+ from
          if (bc("from", 4)) {
            i += 4;

            err = bare_module_lexer__add_name(env, &names, &nl, (const utf8_t *) "default");
            assert(err == 0);

            goto from;
          }
        }
      }
    }

    else if (bu("module", 6)) {
      es = i;

      i += 6;

      while (i < n && ws(u(0))) i++;

      // module\.
      if (c(0) == '.') {
        i++;

        while (i < n && ws(u(0))) i++;

        // module\.exports
        if (bc("exports", 7)) {
          i += 7;

          goto exports;
        }
      }
    }

    else if (bu("export", 6)) {
      es = i;

      i += 6;

      // exports
      if (c(0) == 's') {
        i++;

        goto exports;
      }

      while (i < n && ws(u(0))) i++;

      // export \*
      if (c(0) == '*') {
        i++;

        while (i < n && ws(u(0))) i++;

        // export \* as
        if (i + 3 < n && bu("as", 2) && ws(u(2))) {
          i += 3;

          while (i < n && ws(u(0))) i++;

          // export \* as [^\s]+
          while (i < n && !ws(u(0))) i++;

          while (i < n && ws(u(0))) i++;

          // export \* as [^\s]+ from
          if (bc("from", 4)) {
            type |= bare_module_lexer_import | bare_module_lexer_reexport;
            is = es;

            i += 4;

            err = bare_module_lexer__add_name(env, &names, &nl, (const utf8_t *) "*");
            assert(err == 0);

            goto from;
          }
        }

        // export \* from
        else if (bc("from", 4)) {
          type |= bare_module_lexer_import | bare_module_lexer_reexport;
          is = es;

          i += 4;

          err = bare_module_lexer__add_name(env, &names, &nl, (const utf8_t *) "*");
          assert(err == 0);

          goto from;
        }
      }

      // export {
      else if (c(0) == '{') {
        i++;

        // export {[^}]*
        while (i < n && u(0) != '}') i++;

        // export {[^}]*}
        if (c(0) == '}') {
          i++;

          while (i < n && ws(u(0))) i++;

          // export {[^}]*} from
          if (bc("from", 4)) {
            type |= bare_module_lexer_import | bare_module_lexer_reexport;
            is = es;

            i += 4;

            goto from;
          }
        }
      }
    }

    else i++;

    continue;

  require:
    type |= bare_module_lexer_require;

    while (i < n && ws(u(0))) i++;

    // require\.
    if (c(0) == '.') {
      i++;

      while (i < n && ws(u(0))) i++;

      // require\.a
      if (i + 5 < n && u(0) == 'a') {
        i++;

        // require\.addon
        if (bu("ddon", 4)) {
          i += 4;

          while (i < n && ws(u(0))) i++;

          type |= bare_module_lexer_addon;

          // require\.addon\.
          if (c(0) == '.') {
            i++;

            while (i < n && ws(u(0))) i++;

            // require\.addon\.resolve
            if (i + 7 < n && bu("resolve", 7)) {
              i += 7;

              while (i < n && ws(u(0))) i++;

              type |= bare_module_lexer_resolve;
            }

            else continue;
          }
        }

        // require\.asset
        else if (bu("sset", 4)) {
          i += 4;

          while (i < n && ws(u(0))) i++;

          type |= bare_module_lexer_asset;
        }
      }

      // require\.resolve
      else if (i + 7 < n && bu("resolve", 7)) {
        i += 7;

        while (i < n && ws(u(0))) i++;

        type |= bare_module_lexer_resolve;
      }

      else continue;
    }

    // require(\.(resolve|addon(\.resolve)?|asset))?\(
    if (c(0) == '(') {
      i++;

      while (i < n && ws(u(0))) i++;

      // require(\.(resolve|addon(\.resolve)?|asset))?\(['"]
      if (c(0) == '\'' || c(0) == '"') {
        utf8_t e = u(0);

        ss = ++i;

        while (i < n && u(0) != e) i++;

        // require(\.(resolve|addon(\.resolve)?|asset))?\(['"].*['"]
        if (c(0) == e) {
          se = i;

          i++;

          while (i < n && ws(u(0))) i++;

          while (i < n && u(0) != ')') i++;

          // require(\.(resolve|addon(\.resolve)?|asset))?\(['"].*['"][^)]*\)
          if (c(0) == ')') {
            i++;

            err = bare_module_lexer__add_import(env, imports, &il, s, is, ss, se, type, names);
            if (err < 0) goto err;
          }
        }
      }

      // require\.addon(\.resolve)?\(\)
      else if (c(0) == ')' && (type & bare_module_lexer_addon)) {
        ss = se = i++;

        err = bare_module_lexer__add_import(env, imports, &il, s, is, ss, se, type, names);
        if (err < 0) goto err;
      }
    }

    continue;

  exports:
    while (i < n && ws(u(0))) i++;

    // exports =
    if (c(0) == '=') {
      i++;

      while (i < n && ws(u(0))) i++;

      // exports = \{
      if (c(0) == '{') {
        i++;

        while (c(0) != '}') {
          while (i < n && ws(u(0))) i++;

          if (ids(c(0))) {
            ss = i++;

            while (id(c(0))) i++;

            se = i;

            err = bare_module_lexer__add_export(env, exports, &el, s, es, ss, se);
            if (err < 0) goto err;
          }

          while (i < n && ws(u(0))) i++;

          if (c(0) != ',') break;

          i++;
        }

        // exports = \{[^}]*\}
        if (c(0) == '}') i++;
      }

      // exports = require
      else if (bc("require", 7)) {
        is = i;

        i += 7;

        type |= bare_module_lexer_reexport;

        goto require;
      }
    }

    // exports\.
    else if (c(0) == '.') {
      i++;

      while (i < n && ws(u(0))) i++;

      ss = i;

      while (i < n && !ws(u(0)) && u(0) != '=') i++;

      se = i;

      while (i < n && ws(u(0))) i++;

      // exports\.[^\s=] =
      if (c(0) == '=') {
        i++;

        err = bare_module_lexer__add_export(env, exports, &el, s, es, ss, se);
        if (err < 0) goto err;
      }
    }

    // exports\[
    else if (c(0) == '[') {
      i++;

      while (i < n && ws(u(0))) i++;

      // exports\[['"]
      if (c(0) == '\'' || c(0) == '"') {
        utf8_t e = u(0);

        ss = ++i;

        while (i < n && u(0) != e) i++;

        // exports\[['"].*['"]
        if (c(0) == e) {
          se = i;

          i++;

          while (i < n && ws(u(0))) i++;

          while (i < n && u(0) != ']') i++;

          // exports\[['"].*['"][^\]]*\]
          if (c(0) == ']') {
            i++;

            while (i < n && ws(u(0))) i++;

            // exports\[['"].*['"][^\]]*\] =
            if (c(0) == '=') {
              i++;

              err = bare_module_lexer__add_export(env, exports, &el, s, es, ss, se);
              if (err < 0) goto err;
            }
          }
        }
      }
    }

    continue;

  from:
    while (i < n && ws(u(0))) i++;

    // from ['"]
    if (c(0) == '\'' || c(0) == '"') {
      utf8_t e = u(0);

      ss = ++i;

      while (i < n && u(0) != e) i++;

      // from ['"].*['"]
      if (c(0) == e) {
        se = i;

        i++;

        err = bare_module_lexer__add_import(env, imports, &il, s, is, ss, se, type, names);
        if (err < 0) goto err;
      }
    }

    continue;
  }

#undef u
#undef c
#undef bu
#undef bc
#undef lt
#undef ws
#undef ids
#undef id

  return 0;

err:
  return -1;
}

#endif // BARE_MODULE_LEXER_H
