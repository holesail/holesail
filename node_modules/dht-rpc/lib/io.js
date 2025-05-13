const FIFO = require('fast-fifo')
const sodium = require('sodium-universal')
const c = require('compact-encoding')
const b4a = require('b4a')
const peer = require('./peer')
const {
  INVALID_TOKEN,
  REQUEST_TIMEOUT,
  REQUEST_DESTROYED,
  IO_SUSPENDED
} = require('./errors')

const VERSION = 0b11
const RESPONSE_ID = (0b0001 << 4) | VERSION
const REQUEST_ID = (0b0000 << 4) | VERSION
const EMPTY_ARRAY = []

module.exports = class IO {
  constructor (table, udx, { maxWindow = 80, port = 0, host = '0.0.0.0', anyPort = true, firewalled = true, onrequest, onresponse = noop, ontimeout = noop } = {}) {
    this.table = table
    this.udx = udx
    this.inflight = []
    this.clientSocket = null
    this.serverSocket = null
    this.firewalled = firewalled !== false
    this.ephemeral = true
    this.congestion = new CongestionWindow(maxWindow)
    this.networkInterfaces = udx.watchNetworkInterfaces()
    this.suspended = false

    this.stats = {
      commands: [
        { tx: 0, rx: 0 }, // tx = transmitted, rx = received
        { tx: 0, rx: 0 },
        { tx: 0, rx: 0 },
        { tx: 0, rx: 0 }
      ]
    }

    this.onrequest = onrequest
    this.onresponse = onresponse
    this.ontimeout = ontimeout

    this._pending = new FIFO()
    this._rotateSecrets = 10
    this._tid = (Math.random() * 65536) | 0
    this._secrets = null
    this._drainInterval = null
    this._destroying = null
    this._binding = null

    // port can be a number or a range [start, to]
    this.portRange = port.length
      ? port
      : port === 0 ? [0, 0] : [port, port + 5]

    this._host = host
    this._anyPort = anyPort !== false
    this._boundServerPort = 0
    this._boundClientPort = 0
  }

  onmessage (socket, buffer, { host, port }) {
    if (buffer.byteLength < 2 || !(port > 0 && port < 65536) || this.suspended === true) return

    const from = { id: null, host, port }
    const state = { start: 1, end: buffer.byteLength, buffer }
    const expectedSocket = this.firewalled ? this.clientSocket : this.serverSocket
    const external = socket !== expectedSocket

    if (buffer[0] === REQUEST_ID) {
      const req = Request.decode(this, socket, from, state)
      if (req === null) return
      if (req.token !== null && !b4a.equals(req.token, this.token(req.from, 1)) && !b4a.equals(req.token, this.token(req.from, 0))) {
        req.error(INVALID_TOKEN, { token: true })
        return
      }
      this.onrequest(req, external)
      return
    }

    if (buffer[0] === RESPONSE_ID) {
      const res = decodeReply(from, state)
      if (res === null) return

      for (let i = 0; i < this.inflight.length; i++) {
        const req = this.inflight[i]
        if (req.tid !== res.tid) continue

        res.rtt = Date.now() - req._timestamp

        if (i === this.inflight.length - 1) this.inflight.pop()
        else this.inflight[i] = this.inflight.pop()

        if (req.session) req.session._detach(req)

        // TODO: Auto retry here if errors.INVALID_TOKEN is returned?

        if (req._timeout) {
          clearTimeout(req._timeout)
          req._timeout = null
        }

        this.congestion.recv()

        if (req.internal && req.command < this.stats.commands.length) {
          this.stats.commands[req.command].rx++
        }

        this.onresponse(res, external)
        req.onresponse(res, req)
        break
      }
    }
  }

  token (addr, i) {
    if (this._secrets === null) {
      const buf = b4a.alloc(64)
      this._secrets = [buf.subarray(0, 32), buf.subarray(32, 64)]
      sodium.randombytes_buf(this._secrets[0])
      sodium.randombytes_buf(this._secrets[1])
    }

    const token = b4a.allocUnsafe(32)
    sodium.crypto_generichash(token, b4a.from(addr.host), this._secrets[i])
    return token
  }

  async destroy () {
    if (this._destroying) return this._destroying
    this._destroying = this._destroy()
    return this._destroying
  }

  async _destroy () {
    // simplifies timing to await the bind here also, although it might be unneeded
    await this.bind()
    await this._clear(false)
  }

  async _clear (suspended) {
    if (this._drainInterval) {
      clearInterval(this._drainInterval)
      this._drainInterval = null
    }

    while (this.inflight.length) {
      const req = this.inflight.pop()
      if (req._timeout) clearTimeout(req._timeout)
      req._timeout = null
      req.destroyed = true

      if (req.session) req.session._detach(req)

      this.congestion.recv()

      req.onerror(suspended ? IO_SUSPENDED() : REQUEST_DESTROYED(), req)
    }

    await Promise.allSettled([
      this.serverSocket.close(),
      this.clientSocket.close()
    ])

    this.networkInterfaces.destroy()
  }

  async suspend () {
    this.suspended = true
    await this._clear(true)

    this.congestion.clear()

    if (this._drainInterval) {
      clearInterval(this._drainInterval)
      this._drainInterval = null
    }
  }

  async _rebind (binding) {
    if (binding) await binding
    if (this._destroying) return this._destroying
    await this._bindSockets()
    this.networkInterfaces = this.udx.watchNetworkInterfaces()
  }

  resume () {
    this.suspended = false
    const binding = this._binding
    this._binding = this._rebind(binding)
    return this._binding
  }

  bind () {
    if (this._binding) return this._binding
    this._binding = this._bindSockets()
    return this._binding
  }

  async _bindSockets () {
    const serverSocket = this.udx.createSocket()

    const candidatePorts = []

    // Retrying previous port always has precedence
    if (this._boundServerPort) candidatePorts.push(this._boundServerPort)

    for (let i = this.portRange[0]; i < this.portRange[1]; i++) candidatePorts.push(i)

    for (const port of candidatePorts) {
      if (serverSocket.bound) break

      try {
        serverSocket.bind(port, this._host)
      } catch (err) {
        if (!this._anyPort) {
          await serverSocket.close()
          throw err
        }
      }
    }

    if (!serverSocket.bound) {
      try {
        serverSocket.bind(0, this._host)
      } catch (err) {
        await serverSocket.close()
        throw err
      }
    }

    const clientSocket = this.udx.createSocket()

    try {
      clientSocket.bind(this._boundClientPort || 0, this._host)
    } catch {
      try {
        clientSocket.bind(0, this._host)
      } catch (err) {
        await serverSocket.close()
        await clientSocket.close()
        throw err
      }
    }

    this._boundServerPort = serverSocket.address().port
    this._boundClientPort = clientSocket.address().port

    this.clientSocket = clientSocket
    this.serverSocket = serverSocket

    this.serverSocket.on('message', this.onmessage.bind(this, this.serverSocket))
    this.clientSocket.on('message', this.onmessage.bind(this, this.clientSocket))

    if (this._drainInterval === null) {
      this._drainInterval = setInterval(this._drain.bind(this), 750)
      if (this._drainInterval.unref) this._drainInterval.unref()
    }

    for (const req of this.inflight) {
      if (!req.socket) req.socket = this.firewalled ? this.clientSocket : this.serverSocket
      req.sent = 0
      req.send(false)
    }
  }

  _drain () {
    if (this._secrets !== null && --this._rotateSecrets === 0) {
      this._rotateSecrets = 10
      const tmp = this._secrets[0]
      this._secrets[0] = this._secrets[1]
      this._secrets[1] = tmp
      sodium.crypto_generichash(tmp, tmp)
    }

    this.congestion.drain()

    while (!this.congestion.isFull()) {
      const p = this._pending.shift()
      if (p === undefined) return
      p._sendNow()
    }
  }

  createRequest (to, token, internal, command, target, value, session, ttl) {
    if (this._destroying !== null) return null

    if (this._tid === 65536) this._tid = 0

    const tid = this._tid++
    const socket = this.firewalled ? this.clientSocket : this.serverSocket

    const req = new Request(this, socket, tid, null, to, token, internal, command, target, value, session, ttl || 0)
    this.inflight.push(req)
    if (session) session._attach(req)

    if (internal && command < this.stats.commands.length) {
      this.stats.commands[command].tx++
    }

    return req
  }
}

class Request {
  constructor (io, socket, tid, from, to, token, internal, command, target, value, session, ttl) {
    this.socket = socket
    this.tid = tid
    this.from = from
    this.to = to
    this.token = token
    this.command = command
    this.target = target
    this.value = value
    this.internal = internal
    this.session = session
    this.ttl = ttl
    this.index = -1
    this.sent = 0
    this.retries = 3
    this.destroyed = false

    this.oncycle = noop
    this.onerror = noop
    this.onresponse = noop

    this._buffer = null
    this._io = io
    this._timeout = null
    this._timestamp = Date.now()
  }

  static decode (io, socket, from, state) {
    try {
      const flags = c.uint.decode(state)
      const tid = c.uint16.decode(state)
      const to = peer.ipv4.decode(state)
      const id = flags & 1 ? c.fixed32.decode(state) : null
      const token = flags & 2 ? c.fixed32.decode(state) : null
      const internal = (flags & 4) !== 0
      const command = c.uint.decode(state)
      const target = flags & 8 ? c.fixed32.decode(state) : null
      const value = flags & 16 ? c.buffer.decode(state) : null

      if (id !== null) from.id = validateId(id, from)

      return new Request(io, socket, tid, from, to, token, internal, command, target, value, null, 0)
    } catch {
      return null
    }
  }

  reply (value, opts = {}) {
    const socket = opts.socket || this.socket
    const to = opts.to || this.from
    this._sendReply(0, value || null, opts.token !== false, opts.closerNodes !== false, to, socket)
  }

  error (code, opts = {}) {
    const socket = opts.socket || this.socket
    const to = opts.to || this.from
    this._sendReply(code, null, opts.token === true, opts.closerNodes !== false, to, socket)
  }

  relay (value, to, opts) {
    const socket = (opts && opts.socket) || this.socket
    const buffer = this._encodeRequest(null, value, to, socket)
    socket.trySend(buffer, to.port, to.host, this.ttl)
  }

  send (force = false) {
    if (this.destroyed) return

    if (this.socket === null) return
    if (this._buffer === null) this._buffer = this._encodeRequest(this.token, this.value, this.to, this.socket)

    if (!force && this._io.congestion.isFull()) {
      this._io._pending.push(this)
      return
    }

    this._sendNow()
  }

  sendReply (error, value, token, hasCloserNodes) {
    this._sendReply(error, value, token, hasCloserNodes, this.from, this.socket, null)
  }

  _sendNow () {
    if (this.destroyed) return
    this.sent++
    this._io.congestion.send()
    this.socket.trySend(this._buffer, this.to.port, this.to.host, this.ttl)
    if (this._timeout) clearTimeout(this._timeout)
    this._timeout = setTimeout(oncycle, 1000, this)
  }

  destroy (err) {
    if (this.destroyed) return
    this.destroyed = true

    if (this._timeout) {
      clearTimeout(this._timeout)
      this._timeout = null
    }

    const i = this._io.inflight.indexOf(this)
    if (i === -1) return

    if (i === this._io.inflight.length - 1) this._io.inflight.pop()
    else this._io.inflight[i] = this._io.inflight.pop()

    if (this.session) this.session._detach(this)

    this._io.congestion.recv()

    this.onerror(err || REQUEST_DESTROYED(), this)
  }

  _sendReply (error, value, token, hasCloserNodes, from, socket) {
    if (socket === null || this.destroyed) return

    const id = this._io.ephemeral === false && socket === this._io.serverSocket
    const closerNodes = (this.target !== null && hasCloserNodes) ? this._io.table.closest(this.target) : EMPTY_ARRAY
    const state = { start: 0, end: 1 + 1 + 6 + 2, buffer: null } // (type | version) + flags + to + tid

    if (id) state.end += 32
    if (token) state.end += 32
    if (closerNodes.length > 0) peer.ipv4Array.preencode(state, closerNodes)
    if (error > 0) c.uint.preencode(state, error)
    if (value) c.buffer.preencode(state, value)

    state.buffer = b4a.allocUnsafe(state.end)
    state.buffer[state.start++] = RESPONSE_ID
    state.buffer[state.start++] = (id ? 1 : 0) | (token ? 2 : 0) | (closerNodes.length > 0 ? 4 : 0) | (error > 0 ? 8 : 0) | (value ? 16 : 0)

    c.uint16.encode(state, this.tid)
    peer.ipv4.encode(state, from)

    if (id) c.fixed32.encode(state, this._io.table.id)
    if (token) c.fixed32.encode(state, this._io.token(from, 1))
    if (closerNodes.length > 0) peer.ipv4Array.encode(state, closerNodes)
    if (error > 0) c.uint.encode(state, error)
    if (value) c.buffer.encode(state, value)

    socket.trySend(state.buffer, from.port, from.host, this.ttl)
  }

  _encodeRequest (token, value, to, socket) {
    const id = this._io.ephemeral === false && socket === this._io.serverSocket
    const state = { start: 0, end: 1 + 1 + 6 + 2, buffer: null } // (type | version) + flags + to + tid

    if (id) state.end += 32
    if (token) state.end += 32

    c.uint.preencode(state, this.command)

    if (this.target) state.end += 32
    if (value) c.buffer.preencode(state, value)

    state.buffer = b4a.allocUnsafe(state.end)
    state.buffer[state.start++] = REQUEST_ID
    state.buffer[state.start++] = (id ? 1 : 0) | (token ? 2 : 0) | (this.internal ? 4 : 0) | (this.target ? 8 : 0) | (value ? 16 : 0)

    c.uint16.encode(state, this.tid)
    peer.ipv4.encode(state, to)

    if (id) c.fixed32.encode(state, this._io.table.id)
    if (token) c.fixed32.encode(state, token)

    c.uint.encode(state, this.command)

    if (this.target) c.fixed32.encode(state, this.target)
    if (value) c.buffer.encode(state, value)

    return state.buffer
  }
}

class CongestionWindow {
  constructor (maxWindow) {
    this._i = 0
    this._total = 0
    this._window = [0, 0, 0, 0]
    this._maxWindow = maxWindow
  }

  clear () {
    this._i = 0
    this._total = 0
    this._window = [0, 0, 0, 0]
  }

  isFull () {
    return this._total >= 2 * this._maxWindow || this._window[this._i] >= this._maxWindow
  }

  recv () {
    if (this._window[this._i] > 0) {
      this._window[this._i]--
      this._total--
    }
  }

  send () {
    this._total++
    this._window[this._i]++
  }

  drain () {
    this._i = (this._i + 1) & 3
    this._total -= this._window[this._i]
    this._window[this._i] = 0 // clear oldest
  }
}

function noop () {}

function oncycle (req) {
  req._timeout = null
  req.oncycle(req)
  if (req.sent >= req.retries) {
    req.destroy(REQUEST_TIMEOUT())
    req._io.ontimeout(req)
  } else {
    req.send()
  }
}

function decodeReply (from, state) {
  try {
    const flags = c.uint.decode(state)
    const tid = c.uint16.decode(state)
    const to = peer.ipv4.decode(state)
    const id = flags & 1 ? c.fixed32.decode(state) : null
    const token = flags & 2 ? c.fixed32.decode(state) : null
    const closerNodes = flags & 4 ? peer.ipv4Array.decode(state) : null
    const error = flags & 8 ? c.uint.decode(state) : 0
    const value = flags & 16 ? c.buffer.decode(state) : null

    if (id !== null) from.id = validateId(id, from)

    return { tid, rtt: 0, from, to, token, closerNodes, error, value }
  } catch {
    return null
  }
}

function validateId (id, from) {
  const expected = peer.id(from.host, from.port)
  return b4a.equals(expected, id) ? expected : null
}
