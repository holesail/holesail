const EventEmitter = require('bare-events')
const { Duplex } = require('bare-stream')
const binding = require('./binding')
const constants = require('./lib/constants')
const errors = require('./lib/errors')

const defaultReadBufferSize = 65536

module.exports = exports = class Pipe extends Duplex {
  constructor(path, opts = {}) {
    if (typeof path === 'object' && path !== null) {
      opts = path
      path = null
    }

    const {
      allowHalfOpen = true,
      eagerOpen = true,
      readBufferSize = defaultReadBufferSize
    } = opts

    super({ eagerOpen })

    this._state = 0

    this._allowHalfOpen = allowHalfOpen

    this._fd = -1
    this._path = null

    this._pendingOpen = null
    this._pendingWrite = null
    this._pendingFinal = null
    this._pendingDestroy = null

    this._buffer = Buffer.alloc(readBufferSize)

    this._handle = binding.init(
      this._buffer,
      this,
      noop,
      this._onconnect,
      this._onwrite,
      this._onfinal,
      this._onread,
      this._onclose
    )

    if (typeof path === 'number') {
      this.open(path)
    } else if (typeof path === 'string') {
      this.connect(path)
    }
  }

  get connecting() {
    return (this._state & constants.state.CONNECTING) !== 0
  }

  get pending() {
    return (this._state & constants.state.CONNECTED) === 0
  }

  get readyState() {
    if (
      this._state & constants.state.READABLE &&
      this._state & constants.state.WRITABLE
    ) {
      return 'open'
    }

    if (this._state & constants.state.READABLE) {
      return 'readOnly'
    }

    if (this._state & constants.state.WRITABLE) {
      return 'writeOnly'
    }

    return 'opening'
  }

  open(fd, opts = {}, onconnect) {
    if (typeof opts === 'function') {
      onconnect = opts
      opts = {}
    }

    if (typeof fd === 'object' && fd !== null) {
      opts = fd || {}
      fd = opts.fd
    }

    try {
      const status = binding.open(this._handle, fd)

      this._state |= constants.state.CONNECTED
      this._fd = fd

      if (status & binding.READABLE) {
        this._state |= constants.state.READABLE
      } else {
        this.push(null)
      }

      if (status & binding.WRITABLE) {
        this._state |= constants.state.WRITABLE
      } else {
        this.end()
      }

      if (onconnect) this.once('connect', onconnect)

      queueMicrotask(() => this.emit('connect'))
    } catch (err) {
      queueMicrotask(() => {
        if (this._pendingOpen) this._pendingOpen(err)
        else this.destroy(err)
      })
    }

    return this
  }

  connect(path, opts = {}, onconnect) {
    if (
      this._state & constants.state.CONNECTING ||
      this._state & constants.state.CONNECTED
    ) {
      throw errors.PIPE_ALREADY_CONNECTED('Pipe is already connected')
    }

    this._state |= constants.state.CONNECTING

    if (typeof opts === 'function') {
      onconnect = opts
      opts = {}
    }

    if (typeof path === 'object' && path !== null) {
      opts = path || {}
      path = opts.path
    }

    try {
      binding.connect(this._handle, path)

      this._path = path

      if (onconnect) this.once('connect', onconnect)
    } catch (err) {
      queueMicrotask(() => {
        if (this._pendingOpen) this._pendingOpen(err)
        else this.destroy(err)
      })
    }

    return this
  }

  ref() {
    binding.ref(this._handle)
  }

  unref() {
    binding.unref(this._handle)
  }

  _open(cb) {
    if (this._state & constants.state.CONNECTED) return cb(null)
    this._pendingOpen = cb
  }

  _read() {
    if ((this._state & constants.state.READING) === 0) {
      this._state |= constants.state.READING
      binding.resume(this._handle)
    }
  }

  _writev(batch, cb) {
    this._pendingWrite = [cb, batch]
    binding.writev(
      this._handle,
      batch.map(({ chunk }) => chunk)
    )
  }

  _final(cb) {
    if (
      this._state & constants.state.READABLE &&
      this._state & constants.state.WRITABLE
    ) {
      this._pendingFinal = cb
      binding.end(this._handle)
    } else {
      cb(null)
    }
  }

  _predestroy() {
    if (this._state & constants.state.CLOSING) return
    this._state |= constants.state.CLOSING
    binding.close(this._handle)
  }

  _destroy(err, cb) {
    if (this._state & constants.state.CLOSING) return cb(err)
    this._state |= constants.state.CLOSING
    this._pendingDestroy = cb
    binding.close(this._handle)
  }

  _continueOpen(err) {
    if (this._pendingOpen === null) return
    const cb = this._pendingOpen
    this._pendingOpen = null
    cb(err)
  }

  _continueWrite(err) {
    if (this._pendingWrite === null) return
    const cb = this._pendingWrite[0]
    this._pendingWrite = null
    cb(err)
  }

  _continueFinal(err) {
    if (this._pendingFinal === null) return
    const cb = this._pendingFinal
    this._pendingFinal = null
    cb(err)
  }

  _continueDestroy() {
    if (this._pendingDestroy === null) return
    const cb = this._pendingDestroy
    this._pendingDestroy = null
    cb(null)
  }

  _onconnect(err) {
    if (err) {
      if (this._pendingOpen) this._continueOpen(err)
      else this.destroy(err)
      return
    }

    this._state |=
      constants.state.CONNECTED |
      constants.state.READABLE |
      constants.state.WRITABLE
    this._state &= ~constants.state.CONNECTING
    this._continueOpen()

    this.emit('connect')
  }

  _onread(err, read) {
    if (err) {
      this.destroy(err)
      return
    }

    if (read === 0) {
      this.push(null)
      if (this._allowHalfOpen === false) this.end()
      return
    }

    const copy = Buffer.allocUnsafe(read)
    copy.set(this._buffer.subarray(0, read))

    if (this.push(copy) === false && this.destroying === false) {
      this._state &= ~constants.state.READING
      binding.pause(this._handle)
    }
  }

  _onwrite(err) {
    this._continueWrite(err)
  }

  _onfinal(err) {
    this._continueFinal(err)
  }

  _onclose() {
    this._handle = null
    this._continueDestroy()
  }

  _onspawn(readable, writable) {
    this._state |= constants.state.CONNECTED

    if (readable) {
      this._state |= constants.state.READABLE
    } else {
      this.push(null)
    }

    if (writable) {
      this._state |= constants.state.WRITABLE
    } else {
      this.end()
    }

    this._continueOpen()
  }
}

exports.Pipe = exports

exports.pipe = function pipe() {
  return binding.pipe()
}

exports.Server = class PipeServer extends EventEmitter {
  constructor(opts = {}, onconnection) {
    if (typeof opts === 'function') {
      onconnection = opts
      opts = {}
    }

    super()

    const { readBufferSize = defaultReadBufferSize, allowHalfOpen = true } =
      opts

    this._state = 0

    this._readBufferSize = readBufferSize
    this._allowHalfOpen = allowHalfOpen

    this._path = null
    this._connections = new Set()

    this._error = null
    this._handle = null

    if (onconnection) this.on('connection', onconnection)
  }

  get listening() {
    return (this._state & constants.state.BOUND) !== 0
  }

  address() {
    if ((this._state & constants.state.BOUND) === 0) {
      return null
    }

    return this._path
  }

  listen(path, backlog = 511, opts = {}, onlistening) {
    if (
      this._state & constants.state.BINDING ||
      this._state & constants.state.BOUND
    ) {
      throw errors.SERVER_ALREADY_LISTENING('Server is already listening')
    }

    if (this._state & constants.state.CLOSING) {
      throw errors.SERVER_IS_CLOSED('Server is closed')
    }

    this._state |= constants.state.BINDING

    if (typeof backlog === 'function') {
      onlistening = backlog
      backlog = 511
    } else if (typeof opts === 'function') {
      onlistening = opts
      opts = {}
    }

    if (typeof path === 'object' && path !== null) {
      opts = path || {}
      path = opts.path
      backlog = opts.backlog || 511
    }

    this._handle = binding.init(
      empty,
      this,
      this._onconnection,
      noop,
      noop,
      noop,
      noop,
      this._onclose
    )

    if (this._state & constants.state.UNREFED) binding.unref(this._handle)

    try {
      binding.bind(this._handle, path, backlog)

      this._path = path
      this._state |= constants.state.BOUND
      this._state &= ~constants.state.BINDING

      if (onlistening) this.once('listening', onlistening)

      queueMicrotask(() => this.emit('listening'))
    } catch (err) {
      this._error = err

      binding.close(this._handle)
    }

    return this
  }

  close(onclose) {
    if (onclose) this.once('close', onclose)
    if (this._state & constants.state.CLOSING) return
    this._state |= constants.state.CLOSING
    this._closeMaybe()
  }

  ref() {
    this._state &= ~constants.state.UNREFED
    if (this._handle !== null) binding.ref(this._handle)
  }

  unref() {
    this._state |= constants.state.UNREFED
    if (this._handle !== null) binding.unref(this._handle)
  }

  _closeMaybe() {
    if (this._state & constants.state.CLOSING && this._connections.size === 0) {
      if (this._handle !== null) binding.close(this._handle)
      else queueMicrotask(() => this.emit('close'))
    }
  }

  _onconnection(err) {
    if (err) {
      this.emit('error', err)
      return
    }

    if (this._state & constants.state.CLOSING) return

    const pipe = new exports.Pipe({
      readBufferSize: this._readBufferSize,
      allowHalfOpen: this._allowHalfOpen
    })

    try {
      binding.accept(this._handle, pipe._handle)

      pipe._path = this._path
      pipe._state |=
        constants.state.CONNECTED |
        constants.state.READABLE |
        constants.state.WRITABLE

      this._connections.add(pipe)

      pipe.on('close', () => {
        this._connections.delete(pipe)
        this._closeMaybe()
      })

      this.emit('connection', pipe)
    } catch (err) {
      pipe.destroy()

      throw err
    }
  }

  _onclose() {
    const err = this._error

    this._state &= ~constants.state.BINDING
    this._error = null
    this._handle = null

    if (err) this.emit('error', err)
    else this.emit('close')
  }
}

exports.constants = constants
exports.errors = errors

exports.createConnection = function createConnection(path, opts, onconnect) {
  if (typeof opts === 'function') {
    onconnect = opts
    opts = {}
  }

  if (typeof path === 'object' && path !== null) {
    opts = path || {}
    path = opts.path
  }

  return new exports.Pipe(opts).connect(path, opts, onconnect)
}

exports.createServer = function createServer(opts, onconnection) {
  return new exports.Server(opts, onconnection)
}

const empty = Buffer.alloc(0)

function noop() {}
