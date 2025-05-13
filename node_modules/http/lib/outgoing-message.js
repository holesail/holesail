const { Writable } = require('bare-stream')
const errors = require('./errors')

module.exports = class HTTPOutgoingMessage extends Writable {
  constructor(socket = null) {
    super()

    this.socket = socket
    this.headers = {}
    this.headersSent = false
    this.upgrade = false
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

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value
  }

  flushHeaders() {
    if (this.headersSent === true || this.socket === null) return

    this.socket.write(Buffer.from(this._header()))
    this.headersSent = true
  }

  setTimeout(ms, ontimeout) {
    if (ontimeout) this.once('timeout', ontimeout)

    this.socket.setTimeout(ms)

    return this
  }

  _header() {
    throw errors.NOT_IMPLEMENTED()
  }

  _predestroy() {
    if (this.upgrade === false && this.socket !== null) this.socket.destroy()
  }
}
