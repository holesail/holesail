const sodium = require('sodium-universal')
const b4a = require('b4a')

module.exports = class CipherState {
  constructor (key) {
    this.key = key || null
    this.nonce = 0
    this.CIPHER_ALG = 'ChaChaPoly'
  }

  initialiseKey (key) {
    this.key = key
    this.nonce = 0
  }

  setNonce (nonce) {
    this.nonce = nonce
  }

  encrypt (plaintext, ad) {
    if (!this.hasKey) return plaintext
    if (!ad) ad = b4a.alloc(0)

    const ciphertext = encryptWithAD(this.key, this.nonce, ad, plaintext)
    if (ciphertext.length > 65535) throw new Error(`ciphertext length of ${ciphertext.length} exceeds maximum Noise message length of 65535`)
    this.nonce++

    return ciphertext
  }

  decrypt (ciphertext, ad) {
    if (!this.hasKey) return ciphertext
    if (!ad) ad = b4a.alloc(0)
    if (ciphertext.length > 65535) throw new Error(`ciphertext length of ${ciphertext.length} exceeds maximum Noise message length of 65535`)

    const plaintext = decryptWithAD(this.key, this.nonce, ad, ciphertext)
    this.nonce++

    return plaintext
  }

  get hasKey () {
    return this.key !== null
  }

  _clear () {
    sodium.sodium_memzero(this.key)
    this.key = null
    this.nonce = null
  }

  static get MACBYTES () {
    return 16
  }

  static get NONCEBYTES () {
    return 8
  }

  static get KEYBYTES () {
    return 32
  }
}

function encryptWithAD (key, counter, additionalData, plaintext) {
  // for our purposes, additionalData will always be a pubkey so we encode from hex
  if (!b4a.isBuffer(additionalData)) additionalData = b4a.from(additionalData, 'hex')
  if (!b4a.isBuffer(plaintext)) plaintext = b4a.from(plaintext, 'hex')

  const nonce = b4a.alloc(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES)
  const view = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength)
  view.setUint32(4, counter, true)

  const ciphertext = b4a.alloc(plaintext.byteLength + sodium.crypto_aead_chacha20poly1305_ietf_ABYTES)

  sodium.crypto_aead_chacha20poly1305_ietf_encrypt(ciphertext, plaintext, additionalData, null, nonce, key)
  return ciphertext
}

function decryptWithAD (key, counter, additionalData, ciphertext) {
  // for our purposes, additionalData will always be a pubkey so we encode from hex
  if (!b4a.isBuffer(additionalData)) additionalData = b4a.from(additionalData, 'hex')
  if (!b4a.isBuffer(ciphertext)) ciphertext = b4a.from(ciphertext, 'hex')

  const nonce = b4a.alloc(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES)
  const view = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength)
  view.setUint32(4, counter, true)

  const plaintext = b4a.alloc(ciphertext.byteLength - sodium.crypto_aead_chacha20poly1305_ietf_ABYTES)

  sodium.crypto_aead_chacha20poly1305_ietf_decrypt(plaintext, null, ciphertext, additionalData, nonce, key)
  return plaintext
}
