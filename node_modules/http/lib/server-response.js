const HTTPOutgoingMessage = require('./outgoing-message')
const constants = require('./constants')

module.exports = class HTTPServerResponse extends HTTPOutgoingMessage {
  constructor(socket, req, close) {
    super(socket)

    this.req = req

    this.statusCode = 200
    this.statusMessage = null

    this._chunked = true
    this._close = close
    this._finishing = false
    this._onlyHeaders = req.method === 'HEAD'

    this._pendingWrite = null
  }

  end(data) {
    this._finishing = true
    return super.end(data)
  }

  writeHead(statusCode, statusMessage = null, headers = {}) {
    if (typeof statusMessage === 'object' && statusMessage !== null) {
      headers = statusMessage
      statusMessage = null
    }

    this.statusCode = statusCode
    this.statusMessage = statusMessage || null
    this.headers = headers || {}
  }

  _header() {
    let h =
      'HTTP/1.1 ' +
      this.statusCode +
      ' ' +
      (this.statusMessage === null
        ? constants.status[this.statusCode]
        : this.statusMessage) +
      '\r\n'

    for (const name of Object.keys(this.headers)) {
      const n = name.toLowerCase()
      const v = this.headers[name]

      if (n === 'content-length') this._chunked = false
      if (n === 'connection' && v && v.toLowerCase() === 'close')
        this._close = true

      h += httpCase(n) + ': ' + v + '\r\n'
    }

    if (this._chunked) h += 'Transfer-Encoding: chunked\r\n'

    h += '\r\n'

    return h
  }

  _write(data, encoding, cb) {
    if (this.headersSent === false) {
      if (this._finishing) {
        this.setHeader(
          'Content-Length',
          (data.byteLength + this._writableState.buffered).toString()
        )
      }

      this.flushHeaders()
    }

    if (this._onlyHeaders === true) return cb(null)

    if (this._chunked) {
      data = Buffer.concat([
        Buffer.from('' + data.byteLength.toString(16) + '\r\n'),
        data,
        Buffer.from('\r\n')
      ])
    }

    if (this.socket.write(data)) cb(null)
    else this._pendingWrite = cb
  }

  _final(cb) {
    if (this.headersSent === false) {
      this.setHeader('Content-Length', '0')
      this.flushHeaders()
    }

    if (this._chunked && this._onlyHeaders === false)
      this.socket.write(Buffer.from('0\r\n\r\n'))
    if (this._close) this.socket.end()

    cb(null)
  }

  _predestroy() {
    super._predestroy()
    this.req.destroy()
    this._continueWrite()
  }

  _continueWrite() {
    if (this._pendingWrite === null) return
    const cb = this._pendingWrite
    this._pendingWrite = null
    cb(null)
  }
}

function httpCase(n) {
  let s = ''
  for (const part of n.split('-')) {
    s += (s ? '-' : '') + part.slice(0, 1).toUpperCase() + part.slice(1)
  }
  return s
}
