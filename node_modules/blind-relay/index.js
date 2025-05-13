const EventEmitter = require('events')
const Protomux = require('protomux')
const { Readable } = require('streamx')
const sodium = require('sodium-universal')
const b4a = require('b4a')
const c = require('compact-encoding')
const bitfield = require('compact-encoding-bitfield')
const bits = require('bits-to-bytes')
const errors = require('./lib/errors')

exports.Server = class BlindRelayServer extends EventEmitter {
  constructor (opts = {}) {
    super()

    const {
      createStream
    } = opts

    this._createStream = createStream
    this._pairing = new Map()
    this._sessions = new Set()
  }

  get sessions () {
    return this._sessions[Symbol.iterator]()
  }

  accept (stream, opts) {
    const session = new BlindRelaySession(this, stream, opts)

    this._sessions.add(session)

    return session
  }

  async close () {
    const ending = []

    for (const session of this._sessions) {
      ending.push(session.end())
    }

    await Promise.all(ending)

    this._pairing.clear()
  }
}

class BlindRelaySession extends EventEmitter {
  constructor (server, stream, opts = {}) {
    super()

    const {
      id,
      handshake,
      handshakeEncoding
    } = opts

    this._server = server
    this._mux = Protomux.from(stream)

    this._channel = this._mux.createChannel({
      protocol: 'blind-relay',
      id,
      handshake: handshake ? handshakeEncoding || c.raw : null,
      onopen: this._onopen.bind(this),
      onclose: this._onclose.bind(this),
      ondestroy: this._ondestroy.bind(this)
    })

    this._pair = this._channel.addMessage({
      encoding: m.pair,
      onmessage: this._onpair.bind(this)
    })

    this._unpair = this._channel.addMessage({
      encoding: m.unpair,
      onmessage: this._onunpair.bind(this)
    })

    this._ending = null
    this._destroyed = false
    this._error = null
    this._pairing = new Set()
    this._streams = new Map()

    this._onerror = (err) => this.emit('error', err)

    this._channel.open(handshake)
  }

  get closed () {
    return this._channel.closed
  }

  get mux () {
    return this._mux
  }

  get stream () {
    return this._mux.stream
  }

  _onopen () {
    this.emit('open')
  }

  _onclose () {
    this._ending = Promise.resolve()

    const err = this._error || errors.CHANNEL_CLOSED()

    for (const token of this._pairing) {
      this._server._pairing.delete(token.toString('hex'))
    }

    for (const stream of this._streams.values()) {
      stream
        .off('error', this._onerror)
        .on('error', noop)
        .destroy(err)
    }

    this._pairing.clear()
    this._streams.clear()

    this._server._sessions.delete(this)

    this.emit('close')
  }

  _ondestroy () {
    this._destroyed = true
    this.emit('destroy')
  }

  _onpair ({ isInitiator, token, id: remoteId }) {
    const keyString = token.toString('hex')

    let pair = this._server._pairing.get(keyString)

    if (pair === undefined) {
      pair = new BlindRelayPair(token)
      this._server._pairing.set(keyString, pair)
    } else if (pair.links[+isInitiator]) return

    this._pairing.add(keyString)

    pair.links[+isInitiator] = new BlindRelayLink(this, isInitiator, remoteId)

    if (!pair.paired) return

    this._server._pairing.delete(keyString)

    // 1st pass: Create the raw streams needed for each end of the link.
    for (const link of pair.links) {
      link.createStream()
    }

    // 2nd pass: Connect the raw streams and set up handlers.
    for (const { isInitiator, session, stream } of pair.links) {
      const remote = pair.remote(isInitiator)

      stream
        .on('error', session._onerror)
        .on('close', () => session._streams.delete(keyString))
        .relayTo(remote.stream)

      session._pairing.delete(keyString)
      session._streams.set(keyString, stream)
    }

    // 3rd pass: Let either end of the link know the streams were set up.
    for (const { isInitiator, session, remoteId, stream } of pair.links) {
      session._pair.send({
        isInitiator,
        token,
        id: stream.id,
        seq: 0
      })

      session._endMaybe()

      session.emit('pair', isInitiator, token, stream, remoteId)
    }
  }

  _onunpair ({ token }) {
    const keyString = token.toString('hex')

    const pair = this._server._pairing.get(keyString)

    if (pair) {
      for (const link of pair.links) {
        if (link) link.session._pairing.delete(keyString)
      }

      return this._server._pairing.delete(keyString)
    }

    const stream = this._streams.get(keyString)

    if (stream) {
      stream
        .off('error', this._onerror)
        .on('error', noop)
        .destroy(errors.PAIRING_CANCELLED())

      this._streams.delete(keyString)
    }
  }

  cork () {
    this._channel.cork()
  }

  uncork () {
    this._channel.uncork()
  }

  async end () {
    if (this._ending) return this._ending

    this._ending = EventEmitter.once(this, 'close')
    this._endMaybe()

    return this._ending
  }

  _endMaybe () {
    if (this._ending && this._pairing.size === 0) {
      this._channel.close()
    }
  }

  destroy (err) {
    if (this._destroyed) return
    this._destroyed = true

    this._error = err || errors.CHANNEL_DESTROYED()
    this._channel.close()
  }
}

class BlindRelayPair {
  constructor (token) {
    this.token = token
    this.links = [null, null]
  }

  get paired () {
    return this.links[0] !== null && this.links[1] !== null
  }

  remote (isInitiator) {
    return this.links[isInitiator ? 0 : 1]
  }
}

class BlindRelayLink {
  constructor (session, isInitiator, remoteId) {
    this.session = session
    this.isInitiator = isInitiator
    this.remoteId = remoteId
    this.stream = null
  }

  createStream () {
    if (this.stream) return

    this.stream = this.session._server._createStream({
      firewall: this._onfirewall.bind(this)
    })
  }

  _onfirewall (socket, port, host) {
    this.stream.connect(socket, this.remoteId, port, host)

    return false
  }
}

exports.Client = class BlindRelayClient extends EventEmitter {
  static _clients = new WeakMap()

  static from (stream, opts) {
    let client = this._clients.get(stream)
    if (client) return client
    client = new this(stream, opts)
    this._clients.set(stream, client)
    return client
  }

  constructor (stream, opts = {}) {
    super()

    const {
      id,
      handshake,
      handshakeEncoding
    } = opts

    this._mux = Protomux.from(stream)

    this._channel = this._mux.createChannel({
      protocol: 'blind-relay',
      id,
      handshake: handshake ? handshakeEncoding || c.raw : null,
      onopen: this._onopen.bind(this),
      onclose: this._onclose.bind(this),
      ondestroy: this._ondestroy.bind(this)
    })

    this._pair = this._channel.addMessage({
      encoding: m.pair,
      onmessage: this._onpair.bind(this)
    })

    this._unpair = this._channel.addMessage({
      encoding: m.unpair
    })

    this._ending = false
    this._destroyed = false
    this._error = null
    this._requests = new Map()

    this._channel.open(handshake)
  }

  get closed () {
    return this._channel.closed
  }

  get mux () {
    return this._mux
  }

  get stream () {
    return this._mux.stream
  }

  get requests () {
    return this._requests.values()
  }

  _onopen () {
    this.emit('open')
  }

  _onclose () {
    this._ending = Promise.resolve()

    const err = this._error || errors.CHANNEL_CLOSED()

    for (const request of this._requests.values()) {
      request.destroy(err)
    }

    this._requests.clear()

    this.constructor._clients.delete(this.stream)

    this.emit('close')
  }

  _ondestroy () {
    this._destroyed = true
    this.emit('destroy')
  }

  _onpair ({ isInitiator, token, id: remoteId }) {
    const request = this._requests.get(token.toString('hex'))

    if (request === undefined || request.isInitiator !== isInitiator) return

    request.push(remoteId)
    request.push(null)

    this.emit('pair', request.isInitiator, request.token, request.stream, remoteId)
  }

  pair (isInitiator, token, stream) {
    if (this._destroyed) throw errors.CHANNEL_DESTROYED()

    const keyString = token.toString('hex')

    if (this._requests.has(keyString)) throw errors.ALREADY_PAIRING()

    const request = new BlindRelayRequest(this, isInitiator, token, stream)

    this._requests.set(keyString, request)

    return request
  }

  unpair (token) {
    if (this._destroyed) throw errors.CHANNEL_DESTROYED()

    const request = this._requests.get(token.toString('hex'))

    if (request) request.destroy(errors.PAIRING_CANCELLED())

    this._unpair.send({ token })
  }

  cork () {
    this._channel.cork()
  }

  uncork () {
    this._channel.uncork()
  }

  async end () {
    if (this._ending) return this._ending

    this._ending = EventEmitter.once(this, 'close')
    this._endMaybe()

    return this._ending
  }

  _endMaybe () {
    if (this._ending && this._requests.size === 0) {
      this._channel.close()
    }
  }

  destroy (err) {
    if (this._destroyed) return
    this._destroyed = true

    this._error = err || errors.CHANNEL_DESTROYED()
    this._channel.close()
  }
}

class BlindRelayRequest extends Readable {
  constructor (client, isInitiator, token, stream) {
    super()

    this.client = client
    this.isInitiator = isInitiator
    this.token = token
    this.stream = stream
  }

  _open (cb) {
    if (this.client._destroyed) return cb(errors.CHANNEL_DESTROYED())

    this.client._pair.send({
      isInitiator: this.isInitiator,
      token: this.token,
      id: this.stream.id,
      seq: 0
    })

    cb(null)
  }

  _destroy (cb) {
    this.client._requests.delete(this.token.toString('hex'))

    cb(null)

    this.client._endMaybe()
  }
}

exports.token = function token (buf = b4a.allocUnsafe(32)) {
  sodium.randombytes_buf(buf)
  return buf
}

function noop () {}

const m = exports.messages = {}

const flags = bitfield(7)

m.pair = {
  preencode (state, m) {
    flags.preencode(state)
    c.fixed32.preencode(state, m.token)
    c.uint.preencode(state, m.id)
    c.uint.preencode(state, m.seq)
  },
  encode (state, m) {
    flags.encode(state, bits.of(m.isInitiator))
    c.fixed32.encode(state, m.token)
    c.uint.encode(state, m.id)
    c.uint.encode(state, m.seq)
  },
  decode (state) {
    const [isInitiator] = bits.iterator(flags.decode(state))

    return {
      isInitiator,
      token: c.fixed32.decode(state),
      id: c.uint.decode(state),
      seq: c.uint.decode(state)
    }
  }
}

m.unpair = {
  preencode (state, m) {
    flags.preencode(state)
    c.fixed32.preencode(state, m.token)
  },
  encode (state, m) {
    flags.encode(state, bits.of())
    c.fixed32.encode(state, m.token)
  },
  decode (state) {
    flags.decode(state)

    return {
      token: c.fixed32.decode(state)
    }
  }
}
