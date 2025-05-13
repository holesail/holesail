/* global Bare */
const { Readable, Writable } = require('bare-stream')
const Signal = require('bare-signals')
const binding = require('./binding')
const constants = require('./lib/constants')

const defaultReadBufferSize = 65536

exports.ReadStream = class TTYReadStream extends Readable {
  constructor(fd, opts = {}) {
    super()

    const { readBufferSize = defaultReadBufferSize, allowHalfOpen = true } =
      opts

    this._state = 0

    this._allowHalfOpen = allowHalfOpen

    this._pendingDestroy = null

    this._buffer = Buffer.alloc(readBufferSize)

    this._handle = binding.init(
      fd,
      this._buffer,
      this,
      noop,
      this._onread,
      this._onclose
    )
  }

  get isTTY() {
    return true
  }

  setMode(mode) {
    binding.setMode(this._handle, mode)
    return this
  }

  setRawMode(enabled) {
    return this.setMode(enabled ? constants.mode.RAW : constants.mode.NORMAL)
  }

  _read() {
    if ((this._state & constants.state.READING) === 0) {
      this._state |= constants.state.READING
      binding.resume(this._handle)
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

  _continueDestroy() {
    if (this._pendingDestroy === null) return
    const cb = this._pendingDestroy
    this._pendingDestroy = null
    cb(null)
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

  _onclose() {
    this._handle = null
    this._continueDestroy()
  }
}

exports.WriteStream = class TTYWriteStream extends Writable {
  constructor(fd, opts = {}) {
    super()

    this._state = 0
    this._size = null

    this._pendingWrite = null
    this._pendingDestroy = null

    this._handle = binding.init(
      fd,
      empty,
      this,
      this._onwrite,
      noop,
      this._onclose
    )

    this._size = this.getWindowSize()

    if (TTYWriteStream._streams.size === 0) TTYWriteStream._resize.start()
    TTYWriteStream._streams.add(this)
  }

  get isTTY() {
    return true
  }

  get columns() {
    return this._size[0]
  }

  get rows() {
    return this._size[1]
  }

  getWindowSize() {
    return binding.getWindowSize(this._handle)
  }

  _writev(batch, cb) {
    this._pendingWrite = [cb, batch]
    binding.writev(
      this._handle,
      batch.map(({ chunk }) => chunk)
    )
  }

  _predestroy() {
    if (this._state & constants.state.CLOSING) return
    this._state |= constants.state.CLOSING
    binding.close(this._handle)
    TTYWriteStream._streams.delete(this)
    if (TTYWriteStream._streams.size === 0) TTYWriteStream._resize.stop()
  }

  _destroy(err, cb) {
    if (this._state & constants.state.CLOSING) return cb(err)
    this._state |= constants.state.CLOSING
    this._pendingDestroy = cb
    binding.close(this._handle)
    TTYWriteStream._streams.delete(this)
    if (TTYWriteStream._streams.size === 0) TTYWriteStream._resize.stop()
  }

  _continueWrite(err) {
    if (this._pendingWrite === null) return
    const cb = this._pendingWrite[0]
    this._pendingWrite = null
    cb(err)
  }

  _continueDestroy() {
    if (this._pendingDestroy === null) return
    const cb = this._pendingDestroy
    this._pendingDestroy = null
    cb(null)
  }

  _onwrite(err) {
    this._continueWrite(err)
  }

  _onclose() {
    this._handle = null
    this._continueDestroy()
  }

  _onresize() {
    this._size = this.getWindowSize()
    this.emit('resize')
  }

  static _streams = new Set()

  static _resize = new Signal('SIGWINCH')
}

exports.constants = constants

exports.isTTY = binding.isTTY

exports.isatty = exports.isTTY // For Node.js compatibility

exports.WriteStream._resize
  .on('signal', () => {
    for (const stream of exports.WriteStream._streams) {
      stream._onresize()
    }
  })
  .unref()

const empty = Buffer.alloc(0)

function noop() {}
