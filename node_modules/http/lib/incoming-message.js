const { Readable } = require('bare-stream')

module.exports = class HTTPIncomingMessage extends Readable {
  constructor(socket = null, headers = {}, opts = {}) {
    super()

    this.socket = socket
    this.headers = headers
    this.upgrade = false

    // Server options
    this.method = opts.method || ''
    this.url = opts.url || ''

    // Client options
    this.statusCode = opts.statusCode || 0
    this.statusMessage = opts.statusMessage || ''
  }

  get httpVersion() {
    return '1.1'
  }

  getHeader(name) {
    return this.headers[name.toLowerCase()]
  }

  getHeaders() {
    return { ...this.headers }
  }

  hasHeader(name) {
    return name.toLowerCase() in this.headers
  }

  setTimeout(ms, ontimeout) {
    if (ontimeout) this.once('timeout', ontimeout)

    this.socket.setTimeout(ms)

    return this
  }

  _predestroy() {
    if (this.upgrade === false && this.socket !== null) this.socket.destroy()
  }
}
