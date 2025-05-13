#include <assert.h>
#include <bare.h>
#include <js.h>
#include <openssl/digest.h>
#include <openssl/rand.h>
#include <stddef.h>

enum {
  bare_crypto_md5 = 1,
  bare_crypto_sha1 = 2,
  bare_crypto_sha256 = 3,
  bare_crypto_sha512 = 4,
  bare_crypto_blake2b256 = 5,
};

typedef struct {
  EVP_MD_CTX context;
} bare_crypto_hash_t;

static js_value_t *
bare_crypto_hash_init (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t type;
  err = js_get_value_uint32(env, argv[0], &type);
  assert(err == 0);

  js_value_t *handle;

  bare_crypto_hash_t *hash;
  err = js_create_arraybuffer(env, sizeof(bare_crypto_hash_t), (void **) &hash, &handle);
  assert(err == 0);

  EVP_MD_CTX_init(&hash->context);

  switch (type) {
#define V(algorithm) \
  case bare_crypto_##algorithm: \
    err = EVP_DigestInit(&hash->context, EVP_##algorithm()); \
    break;

    V(md5)
    V(sha1)
    V(sha256)
    V(sha512)
    V(blake2b256)
#undef V

  default:
    err = EVP_MD_CTX_cleanup(&hash->context);
    assert(err == 1);

    return NULL;
  }

  return handle;
}

static js_value_t *
bare_crypto_hash_update (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_crypto_hash_t *hash;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &hash, NULL);
  assert(err == 0);

  void *data;
  size_t len;
  err = js_get_typedarray_info(env, argv[1], NULL, &data, (size_t *) &len, NULL, NULL);
  assert(err == 0);

  err = EVP_DigestUpdate(&hash->context, data, len);
  assert(err == 1);

  return NULL;
}

static js_value_t *
bare_crypto_hash_final (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_crypto_hash_t *hash;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &hash, NULL);
  assert(err == 0);

  js_value_t *result;

  size_t len = EVP_MD_CTX_size(&hash->context);

  uint8_t *digest;
  err = js_create_arraybuffer(env, len, (void **) &digest, &result);
  assert(err == 0);

  err = EVP_DigestFinal(&hash->context, digest, NULL);
  assert(err == 1);

  return result;
}

static js_value_t *
bare_crypto_random_fill (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  uint8_t *data;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &data, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[1], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[2], &len);
  assert(err == 0);

  err = RAND_bytes(&data[offset], len);
  assert(err == 1);

  return NULL;
}

static js_value_t *
bare_crypto_exports (js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("hashInit", bare_crypto_hash_init)
  V("hashUpdate", bare_crypto_hash_update)
  V("hashFinal", bare_crypto_hash_final)

  V("randomFill", bare_crypto_random_fill)
#undef V

#define V(name, n) \
  { \
    js_value_t *val; \
    err = js_create_uint32(env, n, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("MD5", bare_crypto_md5)
  V("SHA1", bare_crypto_sha1)
  V("SHA256", bare_crypto_sha256)
  V("SHA512", bare_crypto_sha512)
  V("BLAKE2B256", bare_crypto_blake2b256)
#undef V

  return exports;
}

BARE_MODULE(bare_crypto, bare_crypto_exports)
