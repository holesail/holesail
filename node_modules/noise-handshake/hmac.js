/* eslint-disable camelcase */
const b4a = require('b4a')
const { sodium_memzero, crypto_generichash, crypto_generichash_batch } = require('sodium-universal')

const HASHLEN = 64
const BLOCKLEN = 128
const scratch = b4a.alloc(BLOCKLEN * 3)
const HMACKey = scratch.subarray(BLOCKLEN * 0, BLOCKLEN * 1)
const OuterKeyPad = scratch.subarray(BLOCKLEN * 1, BLOCKLEN * 2)
const InnerKeyPad = scratch.subarray(BLOCKLEN * 2, BLOCKLEN * 3)

// Post-fill is done in the cases where someone caught an exception that
// happened before we were able to clear data at the end

module.exports = function hmac (out, batch, key) {
  if (key.byteLength > BLOCKLEN) {
    crypto_generichash(HMACKey.subarray(0, HASHLEN), key)
    sodium_memzero(HMACKey.subarray(HASHLEN))
  } else {
    // Covers key <= BLOCKLEN
    HMACKey.set(key)
    sodium_memzero(HMACKey.subarray(key.byteLength))
  }

  for (let i = 0; i < HMACKey.byteLength; i++) {
    OuterKeyPad[i] = 0x5c ^ HMACKey[i]
    InnerKeyPad[i] = 0x36 ^ HMACKey[i]
  }
  sodium_memzero(HMACKey)

  crypto_generichash_batch(out, [InnerKeyPad].concat(batch))
  sodium_memzero(InnerKeyPad)
  crypto_generichash_batch(out, [OuterKeyPad, out])
  sodium_memzero(OuterKeyPad)
}

module.exports.BYTES = HASHLEN
module.exports.KEYBYTES = BLOCKLEN
