const binding = require('./binding')
const { isNode } = require('which-runtime')

module.exports = exports = { ...binding }

exports.sodium_malloc = function (size) {
  const buf = Buffer.from(binding._sodium_malloc(size))
  buf.secure = true

  return buf
}

// typedcall wrappers
const OPTIONAL = Buffer.from(new ArrayBuffer(0))

exports.randombytes_buf = function (buffer) {
  binding.randombytes_buf(
    buffer.buffer, buffer.byteOffset, buffer.byteLength
  )
}

exports.randombytes_buf_deterministic = function (buffer, seed) {
  binding.randombytes_buf_deterministic(
    buffer.buffer, buffer.byteOffset, buffer.byteLength,
    seed.buffer, seed.byteOffset, seed.byteLength
  )
}

/** @returns {bool} */
exports.crypto_box_seal_open = function (m, c, pk, sk) {
  return binding.crypto_box_seal_open(
    m.buffer, m.byteOffset, m.byteLength,
    c.buffer, c.byteOffset, c.byteLength,
    pk.buffer, pk.byteOffset, pk.byteLength,
    sk.buffer, sk.byteOffset, sk.byteLength
  )
}

exports.crypto_generichash = function (output, input, key = OPTIONAL) {
  const res = binding.crypto_generichash(
    output.buffer, output.byteOffset, output.byteLength,
    input.buffer, input.byteOffset, input.byteLength,
    key.buffer, key.byteOffset, key.byteLength
  )

  if (res !== 0) throw new Error('status: ' + res)
}

exports.crypto_generichash_batch = function (output, batch, key) {
  if (isNode || batch.length < 12) { // TODO: re-tune min-batch-size
    // iterate batch from native
    const res = binding.crypto_generichash_batch(output, batch, !!key, key || OPTIONAL)
    if (res !== 0) throw new Error('status: ' + res)
  } else {
    // iterate batch through fastcalls
    const state = Buffer.alloc(binding.crypto_generichash_STATEBYTES)

    exports.crypto_generichash_init(state, key, output.byteLength)

    for (const buf of batch) {
      exports.crypto_generichash_update(state, buf)
    }

    exports.crypto_generichash_final(state, output)
  }
}

exports.crypto_generichash_keygen = function (key) {
  const res = binding.crypto_generichash_keygen(
    key.buffer, key.byteOffset, key.byteLength
  )
  if (res !== 0) throw new Error('status: ' + res)
}

exports.crypto_generichash_init = function (state, key, outputLength) {
  key ||= OPTIONAL

  const res = binding.crypto_generichash_init(
    state.buffer, state.byteOffset, state.byteLength,
    key.buffer, key.byteOffset, key.byteLength,
    outputLength
  )

  if (res !== 0) throw new Error('status: ' + res)
}

exports.crypto_generichash_update = function (state, input) {
  const res = binding.crypto_generichash_update(
    state.buffer, state.byteOffset, state.byteLength,
    input.buffer, input.byteOffset, input.byteLength
  )

  if (res !== 0) throw new Error('status: ' + res)
}

exports.crypto_generichash_final = function (state, output) {
  const res = binding.crypto_generichash_final(
    state.buffer, state.byteOffset, state.byteLength,
    output.buffer, output.byteOffset, output.byteLength
  )

  if (res !== 0) throw new Error('status: ' + res)
}

/** @returns {number} */
exports.crypto_secretstream_xchacha20poly1305_push = function (state, c, m, ad, tag) {
  ad ||= OPTIONAL

  const res = binding.crypto_secretstream_xchacha20poly1305_push(
    state.buffer, state.byteOffset, state.byteLength,
    c.buffer, c.byteOffset, c.byteLength,
    m.buffer, m.byteOffset, m.byteLength,
    ad.buffer, ad.byteOffset, ad.byteLength,
    tag
  )

  if (res < 0) throw new Error('push failed')

  return res
}

/** @returns {number} */
exports.crypto_secretstream_xchacha20poly1305_pull = function (state, m, tag, c, ad) {
  ad ||= OPTIONAL

  // TODO: consider removing tests instead of throwing
  if (c.byteLength < binding.crypto_secretstream_xchacha20poly1305_ABYTES) throw new Error('invalid cipher length')
  if (m.byteLength !== c.byteLength - binding.crypto_secretstream_xchacha20poly1305_ABYTES) throw new Error('invalid message length')

  const res = binding.crypto_secretstream_xchacha20poly1305_pull(
    state.buffer, state.byteOffset, state.byteLength,
    m.buffer, m.byteOffset, m.byteLength,
    tag.buffer, tag.byteOffset, tag.byteLength,
    c.buffer, c.byteOffset, c.byteLength,
    ad.buffer, ad.byteOffset, ad.byteLength
  )

  if (res < 0) throw new Error('pull failed')

  return res
}

/** @returns {boolean} */
exports.crypto_sign_verify_detached = function (sig, m, pk) {
  return binding.crypto_sign_verify_detached(
    sig.buffer, sig.byteOffset, sig.byteLength,
    m.buffer, m.byteOffset, m.byteLength,
    pk.buffer, pk.byteOffset, pk.byteLength
  )
}

exports.crypto_stream_xor = function (c, m, n, k) {
  const res = binding.crypto_stream_xor(
    c.buffer, c.byteOffset, c.byteLength,
    m.buffer, m.byteOffset, m.byteLength,
    n.buffer, n.byteOffset, n.byteLength,
    k.buffer, k.byteOffset, k.byteLength
  )

  if (res !== 0) throw new Error('status: ' + res)
}
