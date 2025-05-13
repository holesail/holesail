const tcp = require('bare-tcp')
const { isEnded, isFinished, getStreamError } = require('bare-stream')
const HTTPIncomingMessage = require('./incoming-message')
const HTTPServerResponse = require('./server-response')
const constants = require('./constants')

const empty = Buffer.alloc(0)

module.exports = class HTTPServerConnection {
  static _connections = new WeakMap()

  static for(socket) {
    return this._connections.get(socket) || null
  }

  constructor(server, socket, opts = {}) {
    const {
      IncomingMessage = HTTPIncomingMessage,
      ServerResponse = HTTPServerResponse
    } = opts

    this.server = server
    this.socket = socket

    this.req = null
    this.res = null

    this._IncomingMessage = IncomingMessage
    this._ServerResponse = ServerResponse

    this._state = constants.state.BEFORE_HEAD
    this._length = -1
    this._read = 0
    this._buffer = null
    this._idle = true

    this._onclose = this._onclose.bind(this)
    this._ondata = this._ondata.bind(this)
    this._ondrain = this._ondrain.bind(this)
    this._ontimeout = this._ontimeout.bind(this)

    socket
      .on('error', noop)
      .on('close', this._onclose)
      .on('data', this._ondata)
      .on('drain', this._ondrain)
      .on('timeout', this._ontimeout)

    HTTPServerConnection._connections.set(socket, this)

    if (this.server.timeout) socket.setTimeout(this.server.timeout)
  }

  get idle() {
    return this._idle
  }

  _onclose() {
    if (this.req && !isEnded(this.req)) this.req.destroy()
    if (this.res && !isFinished(this.res)) this.res.destroy()
    const err = getStreamError(this.socket)
    if (err) this.socket.destroy(err)
  }

  _ondata(data) {
    this._idle = false

    if (this._state === constants.state.IN_BODY) return this._onbody(data)

    if (this._buffer !== null) {
      this._buffer = Buffer.concat([this._buffer, data])
    } else {
      this._buffer = data
    }

    let hits = 0

    for (let i = 0; i < this._buffer.byteLength; i++) {
      const b = this._buffer[i]

      if (hits === 0 && b === 13) {
        hits++
      } else if (hits === 1 && b === 10) {
        hits++

        if (this._state === constants.state.BEFORE_CHUNK) {
          const head = this._buffer.subarray(0, i - 1)
          this._buffer =
            i + 1 === this._buffer.byteLength
              ? null
              : this._buffer.subarray(i + 1)
          i = 0
          hits = 0
          this._onchunklength(head)

          if (this._buffer === null) break
        } else if (this._state === constants.state.IN_CHUNK) {
          const chunk = this._buffer.subarray(0, i - 1)

          if (chunk.byteLength !== this._length) {
            hits = 0
            continue
          }

          this._buffer =
            i + 1 === this._buffer.byteLength
              ? null
              : this._buffer.subarray(i + 1)
          i = 0
          hits = 0
          this._onchunk(chunk)

          if (this._buffer === null) break
        }
      } else if (hits === 2 && b === 13) {
        hits++
      } else if (hits === 3 && b === 10) {
        if (this._state === constants.state.BEFORE_HEAD) {
          const head = this._buffer.subarray(0, i - 3)
          this._buffer =
            i + 1 === this._buffer.byteLength
              ? null
              : this._buffer.subarray(i + 1)
          i = 0
          hits = 0
          this._onhead(head)

          if (this._buffer === null) break
        }
      } else {
        hits = 0
      }
    }
  }

  _onhead(data) {
    this._state = constants.state.IN_HEAD

    const r = data.toString().split('\r\n')
    if (r.length === 0) return this.socket.destroy()

    const [method, url] = r[0].split(' ')
    if (!method || !url) return this.socket.destroy()

    const headers = {}

    for (let i = 1; i < r.length; i++) {
      const [name, value] = r[i].split(': ')
      headers[name.toLowerCase()] = value
    }

    this.req = new this._IncomingMessage(this.socket, headers, { method, url })

    this.req.on('close', () => {
      this.req = null
      this._onreset()
    })

    this.req.resume()
    this.req.pause()

    if (headers.connection && headers.connection.toLowerCase() === 'upgrade') {
      const head = this._buffer
      this._buffer = null
      return this._onupgrade(head)
    }

    this.res = new this._ServerResponse(
      this.socket,
      this.req,
      headers.connection === 'close'
    )

    this.res.on('close', () => {
      this.res = null
    })

    this.server.emit('request', this.req, this.res)

    if (headers['transfer-encoding'] === 'chunked') {
      this._state = constants.state.BEFORE_CHUNK
    } else {
      this._length = parseInt(headers['content-length'], 10) || 0

      if (this._length === 0) return this._onfinished()

      this._state = constants.state.IN_BODY

      if (this._buffer) {
        const body = this._buffer
        this._buffer = null
        this._onbody(body)
      }
    }
  }

  _onchunklength(data) {
    this._length = parseInt(data.toString(), 16)

    if (this._length === 0) this._onfinished()
    else this._state = constants.state.IN_CHUNK
  }

  _onchunk(data) {
    this._read += data.byteLength

    this.req.push(data)

    this._state = constants.state.BEFORE_CHUNK
  }

  _onbody(data) {
    this._read += data.byteLength

    this.req.push(data)

    if (this._read === this._length) this._onfinished()
  }

  _onupgrade(head) {
    this._ondetach()

    const req = this.req

    req.upgrade = true
    req.destroy()

    this.server.emit('upgrade', req, this.socket, head || empty)
  }

  _ontimeout() {
    const reqTimeout = this.req && this.req.emit('timeout')
    const resTimeout = this.res && this.res.emit('timeout')
    const serverTimeout = this.server.emit('timeout', this.socket)

    if (!reqTimeout && !resTimeout && !serverTimeout) this.socket.destroy()
  }

  _onfinished() {
    if (this.req) this.req.push(null)
  }

  _onreset() {
    this._state = constants.state.BEFORE_HEAD
    this._length = -1
    this._read = 0
    this._buffer = null
    this._idle = true

    if (this.server._state & tcp.constants.state.CLOSING) {
      this.socket.destroy()
    }
  }

  _ondrain() {
    if (this.res) this.res._continueWrite()
  }

  _ondetach() {
    this.socket
      .off('error', noop)
      .off('close', this._onclose)
      .off('data', this._ondata)
      .off('drain', this._ondrain)
      .off('timeout', this._ontimeout)

    HTTPServerConnection._connections.delete(this.socket)
  }
}

function noop() {}
