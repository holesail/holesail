const TCPServer = require('bare-tcp').Server
const HTTPServerConnection = require('./server-connection')

module.exports = class HTTPServer extends TCPServer {
  constructor(opts = {}, onrequest) {
    if (typeof opts === 'function') {
      onrequest = opts
      opts = {}
    }

    super({ allowHalfOpen: false })

    this._timeout = 0

    this.on(
      'connection',
      (socket) => new HTTPServerConnection(this, socket, opts)
    )

    if (onrequest) this.on('request', onrequest)
  }

  get timeout() {
    return this._timeout || undefined // For Node.js compatibility
  }

  setTimeout(ms = 0, ontimeout) {
    if (ontimeout) this.on('timeout', ontimeout)

    this._timeout = ms

    return this
  }

  close(onclose) {
    super.close(onclose)

    for (const socket of this._connections) {
      const connection = HTTPServerConnection.for(socket)

      if (connection && connection.idle) {
        socket.destroy()
      }
    }
  }
}
