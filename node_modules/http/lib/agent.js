const tcp = require('bare-tcp')
const HTTPClientConnection = require('./client-connection')

module.exports = class HTTPAgent {
  constructor(opts = {}) {
    const { keepAlive = false, keepAliveMsecs = 1000 } = opts

    this._sockets = new Map()
    this._freeSockets = new Map()

    this._keepAlive =
      typeof keepAlive === 'number'
        ? keepAlive
        : keepAlive
          ? keepAliveMsecs
          : -1

    this._opts = { ...opts }
  }

  createConnection(opts) {
    return tcp.createConnection(opts)
  }

  reuseSocket(socket, req) {
    socket.ref()
  }

  keepSocketAlive(socket) {
    if (this._keepAlive === -1) return false

    socket.setKeepAlive(true, this._keepAlive)
    socket.unref()

    return true
  }

  getName(opts) {
    return `${opts.host}:${opts.port}`
  }

  addRequest(req, opts) {
    opts = { ...opts, ...this._opts }

    const name = this.getName(opts)

    let socket

    if (this._freeSockets.has(name)) {
      const sockets = this._freeSockets.get(name)
      socket = sockets.values().next().value
      sockets.delete(socket)
      if (sockets.size === 0) this._freeSockets.delete(name)

      this.reuseSocket(socket, req)
    } else {
      socket = this.createConnection(opts)

      socket
        .on('free', () => this._onfree(socket, name))
        .on('close', () => this._onremove(socket, name))
        .on('timeout', () => this._ontimeout(socket, name))
    }

    let sockets = this._sockets.get(name)
    if (sockets === undefined) {
      sockets = new Set()
      this._sockets.set(name, sockets)
    }

    sockets.add(socket)

    req.socket = socket

    const connection = HTTPClientConnection.from(socket, opts)

    connection.req = req
  }

  destroy() {
    for (const set of [this._sockets, this._freeSockets]) {
      for (const [, sockets] of set) {
        for (const socket of sockets) socket.destroy()
      }
    }
  }

  _onfree(socket, name) {
    if (this.keepSocketAlive(socket)) {
      this._onremove(socket, name, false)

      let sockets = this._freeSockets.get(name)
      if (sockets === undefined) {
        sockets = new Set()
        this._freeSockets.set(name, sockets)
      }

      sockets.add(socket)
    } else {
      socket.end()
    }
  }

  _onremove(socket, name, all = true) {
    for (const set of all
      ? [this._sockets, this._freeSockets]
      : [this._sockets]) {
      const sockets = set.get(name)
      if (sockets === undefined) continue

      sockets.delete(socket)
      if (sockets.size === 0) set.delete(name)
    }
  }

  _ontimeout(socket, name) {
    const sockets = this._freeSockets.get(name)
    if (!sockets) return

    if (sockets.delete(socket)) socket.destroy()
    if (sockets.size === 0) this._freeSockets.delete(name)
  }

  static global = new this({ keepAlive: 1000, timeout: 5000 })
}
