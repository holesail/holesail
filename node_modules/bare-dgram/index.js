const EventEmitter = require('bare-events')
const UDX = require('udx-native')

const udx = new UDX()

const Socket = exports.Socket = class Socket extends EventEmitter {
  constructor (opts = {}) {
    super()

    this._remotePort = -1
    this._remoteAddress = null
    this._remoteFamily = 0

    this._socket = udx.createSocket(opts)
    this._socket
      .on('error', (err) => this.emit('error', err))
      .on('close', () => this.emit('close'))
      .on('listening', () => queueMicrotask(() => this.emit('listening')) /* Deferred for Node.js compatibility */)
      .on('message', (message, address) => this.emit('message', message, {
        address: address.host,
        family: `IPv${address.family}`,
        port: address.port
      }))
  }

  address () {
    const address = this._socket.address()

    if (address === null) return null

    return {
      address: address.host,
      family: `IPv${address.family}`,
      port: address.port
    }
  }

  remoteAddress () {
    if (this._remotePort === -1) return null

    return {
      address: this._remoteAddress,
      family: `IPv${this._remoteFamily}`,
      port: this._remotePort
    }
  }

  bind (port, address, cb) {
    if (typeof port === 'function') {
      cb = port
      port = 0
      address = null
    } else if (typeof address === 'function') {
      cb = address
      address = null
    }

    if (typeof port === 'object' && port !== null) {
      const opts = port || {}

      port = opts.port || null
      address = opts.address || null
    }

    if (cb) this.once('listening', cb)

    this._socket.bind(port, address)

    return this
  }

  connect (port, address, cb) {
    if (typeof address === 'function') {
      cb = address
      address = null
    }

    this._remotePort = port
    this._remoteAddress = address
    this._remoteFamily = UDX.isIP(address)

    if (cb) this.once('connect', cb)

    queueMicrotask(() => this.emit('connect'))
  }

  async close (cb) {
    try {
      await this._socket.close()

      if (cb) cb(null)
    } catch (err) {
      if (cb) cb(err)
      else throw err
    }
  }

  async send (buffer, offset, length, port, address, cb) {
    if (typeof buffer === 'string') buffer = Buffer.from(buffer)

    if (typeof offset === 'function') {
      cb = offset
      offset = 0
      length = buffer.byteLength
      port = 0
      address = null
    } else if (typeof length === 'function') {
      cb = length
      port = offset
      address = null
      offset = 0
      length = buffer.byteLength
    } else if (typeof port === 'function') {
      cb = port

      if (typeof length === 'string') {
        port = offset
        address = length
        offset = 0
        length = buffer.byteLength
      } else {
        port = 0
        address = null
      }
    } else if (typeof address === 'function') {
      cb = address

      if (typeof port === 'string') {
        address = port
        port = 0
      } else {
        address = null
      }
    }

    if (typeof offset === 'string') {
      address = offset
      port = 0
      offset = 0
      length = buffer.byteLength
    }

    if (typeof length === 'string') {
      address = length
      port = offset
      offset = 0
      length = buffer.byteLength
    } else if (typeof length !== 'number') {
      port = offset
      address = null
      offset = 0
      length = buffer.byteLength
    }

    if (!port) port = this._remotePort
    if (!address) address = this._remoteAddress

    if (offset !== 0 || length !== buffer.byteLength) {
      buffer = buffer.subarray(offset, offset + length)
    }

    try {
      await this._socket.send(buffer, port, address)

      if (cb) cb(null)
    } catch (err) {
      if (cb) cb(err)
      else throw err
    }
  }
}

exports.createSocket = function createSocket (opts, cb) {
  if (typeof opts === 'string') opts = {} // For Node.js compatibility

  const socket = new Socket(opts)

  if (cb) socket.on('message', cb)

  return socket
}
