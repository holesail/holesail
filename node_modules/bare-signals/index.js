/* global Bare */
const EventEmitter = require('bare-events')
const os = require('bare-os')
const binding = require('./binding')
const errors = require('./lib/errors')

const signals = os.constants.signals

module.exports = exports = class Signal extends EventEmitter {
  constructor(signum) {
    super()

    if (typeof signum === 'string') {
      if (signum in signals === false) {
        throw errors.UNKNOWN_SIGNAL('Unknown signal: ' + signum)
      }

      signum = signals[signum]
    }

    this._signum = signum
    this._handle = binding.init(this, this._onsignal, this._onclose)
    this._closing = null
  }

  _onsignal() {
    this.emit('signal', this._signum)
  }

  _onclose() {
    this._handle = null

    this.emit('close')
  }

  start() {
    binding.start(this._handle, this._signum)
  }

  stop() {
    if (this._closing) return
    binding.stop(this._handle)
  }

  ref() {
    binding.ref(this._handle)
  }

  unref() {
    binding.unref(this._handle)
  }

  close() {
    if (this._closing) return this._closing
    this._closing = EventEmitter.once(this, 'close')

    binding.close(this._handle)

    return this._closing
  }

  static send(signum, pid = os.pid()) {
    os.kill(pid, signum)
  }
}

exports.Emitter = require('./lib/emitter')

exports.constants = signals
exports.errors = errors
