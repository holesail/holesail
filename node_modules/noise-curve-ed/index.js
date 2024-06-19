/* eslint-disable camelcase */
const sodium = require('sodium-universal')
const assert = require('nanoassert')
const b4a = require('b4a')

const DHLEN = sodium.crypto_scalarmult_ed25519_BYTES
const PKLEN = sodium.crypto_scalarmult_ed25519_BYTES
const SCALARLEN = sodium.crypto_scalarmult_ed25519_BYTES
const SKLEN = sodium.crypto_sign_SECRETKEYBYTES
const ALG = 'Ed25519'

module.exports = {
  DHLEN,
  PKLEN,
  SCALARLEN,
  SKLEN,
  ALG,
  name: ALG,
  generateKeyPair,
  dh
}

function generateKeyPair (privKey) {
  if (privKey) return generateSeedKeyPair(privKey.subarray(0, 32))

  const keyPair = {}
  keyPair.secretKey = b4a.alloc(SKLEN)
  keyPair.publicKey = b4a.alloc(PKLEN)

  sodium.crypto_sign_keypair(keyPair.publicKey, keyPair.secretKey)
  return keyPair
}

function generateSeedKeyPair (seed) {
  const keyPair = {}
  keyPair.secretKey = b4a.alloc(SKLEN)
  keyPair.publicKey = b4a.alloc(PKLEN)

  sodium.crypto_sign_seed_keypair(keyPair.publicKey, keyPair.secretKey, seed)
  return keyPair
}

function dh (publicKey, { scalar, secretKey }) {
  // tweaked keys expose scalar directly
  if (!scalar) {
    assert(secretKey.byteLength === SKLEN)

    // libsodium stores seed not actual scalar
    const sk = b4a.alloc(64)
    sodium.crypto_hash_sha512(sk, secretKey.subarray(0, 32))
    sk[0] &= 248
    sk[31] &= 127
    sk[31] |= 64

    scalar = sk.subarray(0, 32)
  }

  assert(scalar.byteLength === SCALARLEN)
  assert(publicKey.byteLength === PKLEN)

  const output = b4a.alloc(DHLEN)

  // we clamp if necessary above
  sodium.crypto_scalarmult_ed25519_noclamp(
    output,
    scalar,
    publicKey
  )

  return output
}
