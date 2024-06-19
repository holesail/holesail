const sodium = require('sodium-universal')
const curve = require('noise-curve-ed')
const Noise = require('noise-handshake')
const b4a = require('b4a')

const EMPTY = b4a.alloc(0)

module.exports = class Handshake {
  constructor (isInitiator, keyPair, remotePublicKey, pattern) {
    this.isInitiator = isInitiator
    this.keyPair = keyPair
    this.noise = new Noise(pattern, isInitiator, keyPair, { curve })
    this.noise.initialise(EMPTY, remotePublicKey)
    this.destroyed = false
  }

  static keyPair (seed) {
    const publicKey = b4a.alloc(32)
    const secretKey = b4a.alloc(64)
    if (seed) sodium.crypto_sign_seed_keypair(publicKey, secretKey, seed)
    else sodium.crypto_sign_keypair(publicKey, secretKey)
    return { publicKey, secretKey }
  }

  recv (data) {
    try {
      this.noise.recv(data)
      if (this.noise.complete) return this._return(null)
      return this.send()
    } catch {
      this.destroy()
      return null
    }
  }

  // note that the data returned here is framed so we don't have to do an extra copy
  // when sending it...
  send () {
    try {
      const data = this.noise.send()
      const wrap = b4a.allocUnsafe(data.byteLength + 3)

      writeUint24le(data.byteLength, wrap)
      wrap.set(data, 3)

      return this._return(wrap)
    } catch {
      this.destroy()
      return null
    }
  }

  destroy () {
    if (this.destroyed) return
    this.destroyed = true
  }

  _return (data) {
    const tx = this.noise.complete ? b4a.toBuffer(this.noise.tx) : null
    const rx = this.noise.complete ? b4a.toBuffer(this.noise.rx) : null
    const hash = this.noise.complete ? b4a.toBuffer(this.noise.hash) : null
    const remotePublicKey = this.noise.complete ? b4a.toBuffer(this.noise.rs) : null

    return {
      data,
      remotePublicKey,
      hash,
      tx,
      rx
    }
  }
}

function writeUint24le (n, buf) {
  buf[0] = (n & 255)
  buf[1] = (n >>> 8) & 255
  buf[2] = (n >>> 16) & 255
}
