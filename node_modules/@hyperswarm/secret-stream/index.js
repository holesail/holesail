const { Pull, Push, HEADERBYTES, KEYBYTES, ABYTES } = require('sodium-secretstream')
const sodium = require('sodium-universal')
const crypto = require('hypercore-crypto')
const { Duplex, Writable, getStreamError } = require('streamx')
const b4a = require('b4a')
const Timeout = require('timeout-refresh')
const unslab = require('unslab')
const Bridge = require('./lib/bridge')
const Handshake = require('./lib/handshake')

const IDHEADERBYTES = HEADERBYTES + 32
const [NS_INITIATOR, NS_RESPONDER, NS_SEND] = crypto.namespace('hyperswarm/secret-stream', 3)
const MAX_ATOMIC_WRITE = 256 * 256 * 256 - 1

module.exports = class NoiseSecretStream extends Duplex {
  constructor (isInitiator, rawStream, opts = {}) {
    super({ mapWritable: toBuffer })

    if (typeof isInitiator !== 'boolean') {
      throw new Error('isInitiator should be a boolean')
    }

    this.noiseStream = this
    this.isInitiator = isInitiator
    this.rawStream = null

    this.publicKey = opts.publicKey || null
    this.remotePublicKey = opts.remotePublicKey || null
    this.handshakeHash = null
    this.connected = false
    this.keepAlive = opts.keepAlive || 0
    this.timeout = 0
    this.enableSend = opts.enableSend !== false

    // pointer for upstream to set data here if they want
    this.userData = null

    let openedDone = null
    this.opened = new Promise((resolve) => { openedDone = resolve })

    this.rawBytesWritten = 0
    this.rawBytesRead = 0

    // metadata used by 'hyperdht'
    this.relay = null
    this.puncher = null

    // unwrapped raw stream
    this._rawStream = null

    // handshake state
    this._handshake = null
    this._handshakePattern = opts.pattern || null
    this._handshakeDone = null

    // message parsing state
    this._state = 0
    this._len = 0
    this._tmp = 1
    this._message = null

    this._openedDone = openedDone
    this._startDone = null
    this._drainDone = null
    this._outgoingPlain = null
    this._outgoingWrapped = null
    this._utp = null
    this._setup = true
    this._ended = 2
    this._encrypt = null
    this._decrypt = null
    this._timeoutTimer = null
    this._keepAliveTimer = null
    this._sendState = null

    if (opts.autoStart !== false) this.start(rawStream, opts)

    // wiggle it to trigger open immediately (TODO add streamx option for this)
    this.resume()
    this.pause()
  }

  static keyPair (seed) {
    return Handshake.keyPair(seed)
  }

  static id (handshakeHash, isInitiator, id) {
    return streamId(handshakeHash, isInitiator, id)
  }

  setTimeout (ms) {
    if (!ms) ms = 0

    this._clearTimeout()
    this.timeout = ms

    if (!ms || this.rawStream === null) return

    this._timeoutTimer = Timeout.once(ms, destroyTimeout, this)
    this._timeoutTimer.unref()
  }

  setKeepAlive (ms) {
    if (!ms) ms = 0

    this._clearKeepAlive()

    this.keepAlive = ms

    if (!ms || this.rawStream === null) return

    this._keepAliveTimer = Timeout.on(ms, sendKeepAlive, this)
    this._keepAliveTimer.unref()
  }

  sendKeepAlive () {
    const empty = this.alloc(0)
    this.write(empty)
  }

  start (rawStream, opts = {}) {
    if (rawStream) {
      this.rawStream = rawStream
      this._rawStream = rawStream
      if (typeof this.rawStream.setContentSize === 'function') {
        this._utp = rawStream
      }
    } else {
      this.rawStream = new Bridge(this)
      this._rawStream = this.rawStream.reverse
    }

    this.rawStream.on('error', this._onrawerror.bind(this))
    this.rawStream.on('close', this._onrawclose.bind(this))

    this._startHandshake(opts.handshake, opts.keyPair || null)
    this._continueOpen(null)

    if (this.destroying) return

    if (opts.data) this._onrawdata(opts.data)
    if (opts.ended) this._onrawend()

    if (this.keepAlive > 0 && this._keepAliveTimer === null) {
      this.setKeepAlive(this.keepAlive)
    }

    if (this.timeout > 0 && this._timeoutTimer === null) {
      this.setTimeout(this.timeout)
    }
  }

  async flush () {
    if ((await this.opened) === false) return false
    if ((await Writable.drained(this)) === false) return false
    if (this.destroying) return false

    if (this.rawStream !== null && this.rawStream.flush) {
      return await this.rawStream.flush()
    }

    return true
  }

  _continueOpen (err) {
    if (err) this.destroy(err)
    if (this._startDone === null) return
    const done = this._startDone
    this._startDone = null
    this._open(done)
  }

  _onkeypairpromise (p) {
    const self = this
    const cont = this._continueOpen.bind(this)

    p.then(onkeypair, cont)

    function onkeypair (kp) {
      self._onkeypair(kp)
      cont(null)
    }
  }

  _onkeypair (keyPair) {
    const pattern = this._handshakePattern || 'XX'
    const remotePublicKey = this.remotePublicKey

    this._handshake = new Handshake(this.isInitiator, keyPair, remotePublicKey, pattern)
    this.publicKey = this._handshake.keyPair.publicKey
  }

  _startHandshake (handshake, keyPair) {
    if (handshake) {
      const { tx, rx, hash, publicKey, remotePublicKey } = handshake
      this._setupSecretStream(tx, rx, hash, publicKey, remotePublicKey)
      return
    }

    if (!keyPair) keyPair = Handshake.keyPair()

    if (typeof keyPair.then === 'function') {
      this._onkeypairpromise(keyPair)
    } else {
      this._onkeypair(keyPair)
    }
  }

  _onrawerror (err) {
    this.destroy(err)
  }

  _onrawclose () {
    if (this._ended !== 0) this.destroy()
  }

  _onrawdata (data) {
    let offset = 0

    if (this._timeoutTimer !== null) {
      this._timeoutTimer.refresh()
    }

    do {
      switch (this._state) {
        case 0: {
          while (this._tmp !== 0x1000000 && offset < data.byteLength) {
            const v = data[offset++]
            this._len += this._tmp * v
            this._tmp *= 256
          }

          if (this._tmp === 0x1000000) {
            this._tmp = 0
            this._state = 1
            const unprocessed = data.byteLength - offset
            if (unprocessed < this._len && this._utp !== null) this._utp.setContentSize(this._len - unprocessed)
          }

          break
        }

        case 1: {
          const missing = this._len - this._tmp
          const end = missing + offset

          if (this._message === null && end <= data.byteLength) {
            this._message = data.subarray(offset, end)
            offset += missing
            this._incoming()
            break
          }

          const unprocessed = data.byteLength - offset

          if (this._message === null) {
            this._message = b4a.allocUnsafe(this._len)
          }

          b4a.copy(data, this._message, this._tmp, offset)
          this._tmp += unprocessed

          if (end <= data.byteLength) {
            offset += missing
            this._incoming()
          } else {
            offset += unprocessed
          }

          break
        }
      }
    } while (offset < data.byteLength && !this.destroying)
  }

  _onrawend () {
    this._ended--
    this.push(null)
  }

  _onrawdrain () {
    const drain = this._drainDone
    if (drain === null) return
    this._drainDone = null
    drain()
  }

  _read (cb) {
    this.rawStream.resume()
    cb(null)
  }

  _incoming () {
    const message = this._message

    this._state = 0
    this._len = 0
    this._tmp = 1
    this._message = null

    if (this._setup === true) {
      if (this._handshake) {
        this._onhandshakert(this._handshake.recv(message))
      } else {
        if (message.byteLength !== IDHEADERBYTES) {
          this.destroy(new Error('Invalid header message received'))
          return
        }

        const remoteId = message.subarray(0, 32)
        const expectedId = streamId(this.handshakeHash, !this.isInitiator)
        const header = message.subarray(32)

        if (!b4a.equals(expectedId, remoteId)) {
          this.destroy(new Error('Invalid header received'))
          return
        }

        this._decrypt.init(header)
        this._setup = false // setup is now done
      }
      return
    }

    if (message.byteLength < ABYTES) {
      this.destroy(new Error('Invalid message received'))
      return
    }

    this.rawBytesRead += message.byteLength

    const plain = message.subarray(1, message.byteLength - ABYTES + 1)

    try {
      this._decrypt.next(message, plain)
    } catch (err) {
      this.destroy(err)
      return
    }

    // If keep alive is selective, eat the empty buffers (ie assume the other side has it enabled also)
    if (plain.byteLength === 0 && this.keepAlive !== 0) return

    if (this.push(plain) === false) {
      this.rawStream.pause()
    }
  }

  _onhandshakert (h) {
    if (this._handshakeDone === null) return

    if (h !== null) {
      if (h.data) this._rawStream.write(h.data)
      if (!h.tx) return
    }

    const done = this._handshakeDone
    const publicKey = this._handshake.keyPair.publicKey

    this._handshakeDone = null
    this._handshake = null

    if (h === null) return done(new Error('Noise handshake failed'))

    this._setupSecretStream(h.tx, h.rx, h.hash, publicKey, h.remotePublicKey)
    this._resolveOpened(true)
    done(null)
  }

  _setupSecretStream (tx, rx, handshakeHash, publicKey, remotePublicKey) {
    const buf = b4a.allocUnsafeSlow(3 + IDHEADERBYTES)
    writeUint24le(IDHEADERBYTES, buf)

    this._encrypt = new Push(unslab(tx.subarray(0, KEYBYTES)), undefined, buf.subarray(3 + 32))
    this._decrypt = new Pull(unslab(rx.subarray(0, KEYBYTES)))

    this.publicKey = publicKey
    this.remotePublicKey = remotePublicKey
    this.handshakeHash = handshakeHash

    const id = buf.subarray(3, 3 + 32)
    streamId(handshakeHash, this.isInitiator, id)

    // initialize secretbox state for unordered messages
    this._setupSecretSend(handshakeHash)

    this.emit('handshake')
    // if rawStream is a bridge, also emit it there
    if (this.rawStream !== this._rawStream) this.rawStream.emit('handshake')

    if (this.destroying) return

    this._rawStream.write(buf)
  }

  _setupSecretSend (handshakeHash) {
    this._sendState = b4a.allocUnsafeSlow(32 + 32 + 8 + 8)
    const encrypt = this._sendState.subarray(0, 32) // secrets
    const decrypt = this._sendState.subarray(32, 64)
    const counter = this._sendState.subarray(64, 72) // nonce
    const initial = this._sendState.subarray(72)

    const inputs = this.isInitiator
      ? [[NS_INITIATOR, NS_SEND], [NS_RESPONDER, NS_SEND]]
      : [[NS_RESPONDER, NS_SEND], [NS_INITIATOR, NS_SEND]]

    sodium.crypto_generichash_batch(encrypt, inputs[0], handshakeHash)
    sodium.crypto_generichash_batch(decrypt, inputs[1], handshakeHash)

    sodium.randombytes_buf(initial)
    counter.set(initial)
  }

  _open (cb) {
    // no autostart or no handshake yet
    if (this._rawStream === null || (this._handshake === null && this._encrypt === null)) {
      this._startDone = cb
      return
    }

    this._rawStream.on('data', this._onrawdata.bind(this))
    this._rawStream.on('end', this._onrawend.bind(this))
    this._rawStream.on('drain', this._onrawdrain.bind(this))

    if (this.enableSend) this._rawStream.on('message', this._onmessage.bind(this))

    if (this._encrypt !== null) {
      this._resolveOpened(true)
      return cb(null)
    }

    this._handshakeDone = cb

    if (this.isInitiator) this._onhandshakert(this._handshake.send())
  }

  _predestroy () {
    if (this.rawStream) {
      const error = getStreamError(this)
      this.rawStream.destroy(error)
    }

    if (this._startDone !== null) {
      const done = this._startDone
      this._startDone = null
      done(new Error('Stream destroyed'))
    }

    if (this._handshakeDone !== null) {
      const done = this._handshakeDone
      this._handshakeDone = null
      done(new Error('Stream destroyed'))
    }

    if (this._drainDone !== null) {
      const done = this._drainDone
      this._drainDone = null
      done(new Error('Stream destroyed'))
    }
  }

  _write (data, cb) {
    let wrapped = this._outgoingWrapped

    if (data !== this._outgoingPlain) {
      wrapped = b4a.allocUnsafe(data.byteLength + 3 + ABYTES)
      wrapped.set(data, 4)
    } else {
      this._outgoingWrapped = this._outgoingPlain = null
    }

    if (wrapped.byteLength - 3 > MAX_ATOMIC_WRITE) {
      return cb(new Error('Message is too large for an atomic write. Max size is ' + MAX_ATOMIC_WRITE + ' bytes.'))
    }
    this.rawBytesWritten += wrapped.byteLength

    writeUint24le(wrapped.byteLength - 3, wrapped)
    // offset 4 so we can do it in-place
    this._encrypt.next(wrapped.subarray(4, 4 + data.byteLength), wrapped.subarray(3))

    if (this._keepAliveTimer !== null) this._keepAliveTimer.refresh()

    if (this._rawStream.write(wrapped) === false) {
      this._drainDone = cb
    } else {
      cb(null)
    }
  }

  _final (cb) {
    this._clearKeepAlive()
    this._ended--
    this._rawStream.end()
    cb(null)
  }

  _resolveOpened (val) {
    if (this._openedDone === null) return
    const opened = this._openedDone
    this._openedDone = null
    opened(val)
    if (!val) return
    this.connected = true
    this.emit('connect')
  }

  _clearTimeout () {
    if (this._timeoutTimer === null) return
    this._timeoutTimer.destroy()
    this._timeoutTimer = null
    this.timeout = 0
  }

  _clearKeepAlive () {
    if (this._keepAliveTimer === null) return
    this._keepAliveTimer.destroy()
    this._keepAliveTimer = null
    this.keepAlive = 0
  }

  _destroy (cb) {
    this._clearKeepAlive()
    this._clearTimeout()
    this._resolveOpened(false)
    cb(null)
  }

  _boxMessage (buffer) {
    const MB = sodium.crypto_secretbox_MACBYTES // 16
    const NB = sodium.crypto_secretbox_NONCEBYTES // 24

    const counter = this._sendState.subarray(64, 72)
    sodium.sodium_increment(counter)
    if (b4a.equals(counter, this._sendState.subarray(72))) {
      this.destroy(new Error('udp send nonce exchausted'))
      return
    }

    const secret = this._sendState.subarray(0, 32)
    const envelope = b4a.allocUnsafe(8 + MB + buffer.byteLength)
    const nonce = envelope.subarray(0, NB)
    const ciphertext = envelope.subarray(8)

    b4a.fill(nonce, 0) // pad suffix
    nonce.set(counter)

    sodium.crypto_secretbox_easy(ciphertext, buffer, nonce, secret)
    return envelope
  }

  send (buffer) {
    if (!this._sendState) return
    if (!this.rawStream?.send) return // udx-stream expected

    const message = this._boxMessage(buffer)
    return this.rawStream.send(message)
  }

  trySend (buffer) {
    if (!this._sendState) return
    if (!this.rawStream?.trySend) return // udx-stream expected

    const message = this._boxMessage(buffer)
    this.rawStream.trySend(message)
  }

  _onmessage (buffer) {
    if (!this._sendState) return // messages before handshake are dropped

    const MB = sodium.crypto_secretbox_MACBYTES // 16
    const NB = sodium.crypto_secretbox_NONCEBYTES // 24

    if (buffer.byteLength < NB) return // Invalid message

    const nonce = b4a.allocUnsafe(NB)
    b4a.fill(nonce, 0)
    nonce.set(buffer.subarray(0, 8))

    const secret = this._sendState.subarray(32, 64)
    const ciphertext = buffer.subarray(8)
    const plain = buffer.subarray(8, buffer.byteLength - MB)

    if (ciphertext.byteLength < MB) return // invalid message

    const success = sodium.crypto_secretbox_open_easy(plain, ciphertext, nonce, secret)

    if (success) this.emit('message', plain)
  }

  alloc (len) {
    const buf = b4a.allocUnsafe(len + 3 + ABYTES)
    this._outgoingWrapped = buf
    this._outgoingPlain = buf.subarray(4, buf.byteLength - ABYTES + 1)
    return this._outgoingPlain
  }

  toJSON () {
    return {
      isInitiator: this.isInitiator,
      publicKey: this.publicKey && b4a.toString(this.publicKey, 'hex'),
      remotePublicKey: this.remotePublicKey && b4a.toString(this.remotePublicKey, 'hex'),
      connected: this.connected,
      destroying: this.destroying,
      destroyed: this.destroyed,
      rawStream: this.rawStream && this.rawStream.toJSON ? this.rawStream.toJSON() : null
    }
  }
}

function writeUint24le (n, buf) {
  buf[0] = (n & 255)
  buf[1] = (n >>> 8) & 255
  buf[2] = (n >>> 16) & 255
}

function streamId (handshakeHash, isInitiator, out = b4a.allocUnsafe(32)) {
  sodium.crypto_generichash(out, isInitiator ? NS_INITIATOR : NS_RESPONDER, handshakeHash)
  return out
}

function toBuffer (data) {
  return typeof data === 'string' ? b4a.from(data) : data
}

function destroyTimeout () {
  this.destroy(new Error('Stream timed out'))
}

function sendKeepAlive () {
  const empty = this.alloc(0)
  this.write(empty)
}
