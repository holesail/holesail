const EventEmitter = require('bare-events')
const { Duplex } = require('bare-stream')
const tcp = require('bare-tcp')
const pipe = require('bare-pipe')

const defaultReadBufferSize = 65536

const constants = (exports.constants = {
  type: {
    TCP: 1,
    IPC: 2
  },
  state: {
    UNREFED: 0x1
  }
})

exports.Socket = class NetSocket extends Duplex {
  constructor(opts = {}) {
    super({ eagerOpen: true })

    const { readBufferSize = defaultReadBufferSize, allowHalfOpen = true } =
      opts

    this._opts = { readBufferSize, allowHalfOpen }
    this._type = 0
    this._state = 0
    this._socket = null

    this._pendingWrite = null
    this._pendingFinal = null
  }

  get connecting() {
    return this._socket !== null && this._socket.connecting
  }

  get pending() {
    return this._socket === null || this._socket.pending
  }

  connect(...args) {
    let opts = {}
    let onconnect

    // connect(path[, onconnect])
    if (typeof args[0] === 'string') {
      opts.path = args[0]
      onconnect = args[1]
      // connect(port[, host][, onconnect])
    } else if (typeof args[0] === 'number') {
      opts.port = args[0]

      if (typeof args[1] === 'function') {
        onconnect = args[1]
      } else {
        opts.host = args[1]
        onconnect = args[2]
      }
      // connect(opts[, onconnect])
    } else {
      opts = args[0] || {}
      onconnect = args[1]
    }

    opts = { ...opts, ...this._opts }

    if (opts.path) {
      this._attach(constants.type.IPC, pipe.createConnection(opts))
    } else {
      this._attach(constants.type.TCP, tcp.createConnection(opts))
    }

    if (onconnect) this.once('connect', onconnect)

    return this
  }

  ref() {
    this._state &= ~constants.state.UNREFED
    if (this._socket !== null) this._socket.ref()
  }

  unref() {
    this._state |= constants.state.UNREFED
    if (this._socket !== null) this._socket.unref()
  }

  _attach(type, socket) {
    this._type = type
    this._socket = socket

    this._socket
      .on('connect', this._onconnect.bind(this))
      .on('error', this._onerror.bind(this))
      .on('close', this._onclose.bind(this))
      .on('end', this._onend.bind(this))
      .on('data', this._ondata.bind(this))
      .on('drain', this._ondrain.bind(this))

    if (this._state & constants.state.UNREFED) this._socket.unref()

    return this
  }

  _write(data, encoding, cb) {
    if (this._socket !== null && this._socket.write(data)) cb(null)
    else this._pendingWrite = cb
  }

  _final(cb) {
    if (this._socket === null) return cb(null)
    this._pendingFinal = cb
    this._socket.end()
  }

  _predestroy() {
    if (this._socket === null) return
    this._socket.destroy()
  }

  _onconnect() {
    this._ondrain() // Flush any pending writes

    this.emit('connect')
  }

  _onerror(err) {
    this.destroy(err)
  }

  _onend() {
    if (this._pendingFinal === null) return
    const cb = this._pendingFinal
    this._pendingFinal = null
    cb(null)
  }

  _onclose() {
    this.push(null)
  }

  _ondata(data) {
    this.push(data)
  }

  _ondrain() {
    if (this._pendingWrite === null) return
    const cb = this._pendingWrite
    this._pendingWrite = null
    cb(null)
  }
}

exports.Server = class NetServer extends EventEmitter {
  constructor(opts = {}, onconnection) {
    if (typeof opts === 'function') {
      onconnection = opts
      opts = {}
    }

    super()

    const { readBufferSize = defaultReadBufferSize, allowHalfOpen = true } =
      opts

    this._opts = { readBufferSize, allowHalfOpen }
    this._type = 0
    this._state = 0
    this._server = null

    if (onconnection) this.on('connection', onconnection)
  }

  get listening() {
    return this._server !== null && this._server.listening
  }

  address() {
    return this._server === null ? null : this._server.address()
  }

  listen(...args) {
    let opts = {}
    let onlistening

    // listen(path[, backlog][, onlistening])
    if (typeof args[0] === 'string') {
      opts.path = args[0]

      if (typeof args[1] === 'function') {
        onlistening = args[1]
      } else {
        opts.backlog = args[1]
        onlistening = args[2]
      }
      // listen([port[, host[, backlog]]][, onlistening])
    } else {
      if (typeof args[0] === 'function') {
        onlistening = args[0]
      } else {
        opts.port = args[0]

        if (typeof args[1] === 'function') {
          onlistening = args[1]
        } else {
          opts.host = args[1]

          if (typeof args[2] === 'function') {
            onlistening = args[2]
          } else {
            opts.backlog = args[2]
            onlistening = args[3]
          }
        }
      }
    }

    opts = { ...opts, ...this._opts }

    if (opts.path) {
      this._attach(constants.type.IPC, pipe.createServer(opts))
    } else {
      this._attach(constants.type.TCP, tcp.createServer(opts))
    }

    this._server.listen(opts)

    if (onlistening) this.once('listening', onlistening)

    return this
  }

  close(onclose) {
    if (onclose) this.once('close', onclose)
    this._server.close()
  }

  ref() {
    this._state &= ~constants.state.UNREFED
    if (this._server !== null) this._server.ref()
  }

  unref() {
    this._state |= constants.state.UNREFED
    if (this._server !== null) this._server.unref()
  }

  _attach(type, server) {
    this._type = type
    this._server = server

    this._server
      .on('listening', this._onlistening.bind(this))
      .on('connection', this._onconnection.bind(this))
      .on('error', this._onerror.bind(this))
      .on('close', this._onclose.bind(this))

    if (this._state & constants.state.UNREFED) this._server.unref()

    return this
  }

  _onlistening() {
    this.emit('listening')
  }

  _onconnection(socket) {
    this.emit(
      'connection',
      new exports.Socket(this._opts)._attach(this._type, socket)
    )
  }

  _onerror(err) {
    this.emit('error', err)
  }

  _onclose() {
    this.emit('close')
  }
}

exports.isIP = tcp.isIP
exports.isIPv4 = tcp.isIPv4
exports.isIPv6 = tcp.isIPv6

exports.createConnection = function createConnection(...args) {
  let opts = {}
  let onconnect

  // createConnection(path[, onconnect])
  if (typeof args[0] === 'string') {
    opts.path = args[0]
    onconnect = args[1]
    // createConnection(port[, host][, onconnect])
  } else if (typeof args[0] === 'number') {
    opts.port = args[0]

    if (typeof args[1] === 'function') {
      onconnect = args[1]
    } else {
      opts.host = args[1]
      onconnect = args[2]
    }
    // createConnection(opts[, onconnect])
  } else {
    opts = args[0] || {}
    onconnect = args[1]
  }

  return new exports.Socket(opts).connect(opts, onconnect)
}

// For Node.js compatibility
exports.connect = exports.createConnection

exports.createServer = function createServer(opts, onconnection) {
  return new exports.Server(opts, onconnection)
}
