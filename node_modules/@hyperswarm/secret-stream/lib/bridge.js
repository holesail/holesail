const { Duplex, Writable } = require('streamx')

class ReversePassThrough extends Duplex {
  constructor (s) {
    super()
    this._stream = s
    this._ondrain = null
  }

  _write (data, cb) {
    if (this._stream.push(data) === false) {
      this._stream._ondrain = cb
    } else {
      cb(null)
    }
  }

  _final (cb) {
    this._stream.push(null)
    cb(null)
  }

  _read (cb) {
    const ondrain = this._ondrain
    this._ondrain = null
    if (ondrain) ondrain()
    cb(null)
  }
}

module.exports = class Bridge extends Duplex {
  constructor (noiseStream) {
    super()

    this.noiseStream = noiseStream

    this._ondrain = null
    this.reverse = new ReversePassThrough(this)
  }

  get publicKey () {
    return this.noiseStream.publicKey
  }

  get remotePublicKey () {
    return this.noiseStream.remotePublicKey
  }

  get handshakeHash () {
    return this.noiseStream.handshakeHash
  }

  flush () {
    return Writable.drained(this)
  }

  _read (cb) {
    const ondrain = this._ondrain
    this._ondrain = null
    if (ondrain) ondrain()
    cb(null)
  }

  _write (data, cb) {
    if (this.reverse.push(data) === false) {
      this.reverse._ondrain = cb
    } else {
      cb(null)
    }
  }

  _final (cb) {
    this.reverse.push(null)
    cb(null)
  }
}
