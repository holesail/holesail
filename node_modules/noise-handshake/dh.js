/* eslint-disable camelcase */
const {
  crypto_kx_SEEDBYTES,
  crypto_kx_keypair,
  crypto_kx_seed_keypair,
  crypto_scalarmult_BYTES,
  crypto_scalarmult_SCALARBYTES,
  crypto_scalarmult,
  crypto_scalarmult_base
} = require('sodium-universal')

const assert = require('nanoassert')
const b4a = require('b4a')

const DHLEN = crypto_scalarmult_BYTES
const PKLEN = crypto_scalarmult_BYTES
const SKLEN = crypto_scalarmult_SCALARBYTES
const SEEDLEN = crypto_kx_SEEDBYTES
const ALG = '25519'

module.exports = {
  DHLEN,
  PKLEN,
  SKLEN,
  SEEDLEN,
  ALG,
  generateKeyPair,
  generateSeedKeyPair,
  dh
}

function generateKeyPair (privKey) {
  const keyPair = {}

  keyPair.secretKey = privKey || b4a.alloc(SKLEN)
  keyPair.publicKey = b4a.alloc(PKLEN)

  if (privKey) {
    crypto_scalarmult_base(keyPair.publicKey, keyPair.secretKey)
  } else {
    crypto_kx_keypair(keyPair.publicKey, keyPair.secretKey)
  }

  return keyPair
}

function generateSeedKeyPair (seed) {
  assert(seed.byteLength === SKLEN)

  const keyPair = {}
  keyPair.secretKey = b4a.alloc(SKLEN)
  keyPair.publicKey = b4a.alloc(PKLEN)

  crypto_kx_seed_keypair(keyPair.publicKey, keyPair.secretKey, seed)
  return keyPair
}

function dh (publicKey, { secretKey }) {
  assert(secretKey.byteLength === SKLEN)
  assert(publicKey.byteLength === PKLEN)

  const output = b4a.alloc(DHLEN)

  crypto_scalarmult(
    output,
    secretKey,
    publicKey
  )

  return output
}
