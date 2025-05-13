const EventEmitter = require('bare-events')
const Signal = require('..')

module.exports = class SignalEmitter extends EventEmitter {
  constructor() {
    super()

    this._signals = new Map()
    this._unrefed = false

    this.on('newListener', this._onnewlistener).on(
      'removeListener',
      this._onremovelistener
    )
  }

  ref() {
    this._unrefed = false
    for (const signal of this._signals.values()) signal.ref()
  }

  unref() {
    this._unrefed = true
    for (const signal of this._signals.values()) signal.unref()
  }

  _onnewlistener(name) {
    if (name === 'newListener' || name === 'removeListener') return

    if (this.listenerCount(name) === 0) {
      const signal = new Signal(name)

      signal.on('signal', this._onsignal.bind(this, name)).start()

      if (this._unrefed) signal.unref()

      this._signals.set(name, signal)
    }
  }

  _onremovelistener(name) {
    if (name === 'newListener' || name === 'removeListener') return

    if (this.listenerCount(name) === 0) {
      const signal = this._signals.get(name)

      if (this._unrefed) signal.ref()

      signal.close()

      this._signals.delete(name)
    }
  }

  _onsignal(name) {
    this.emit(name)
  }
}
