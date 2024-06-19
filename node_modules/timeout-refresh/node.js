module.exports = class Timer {
  constructor (ms, fn, ctx = null, interval = false) {
    this.ms = ms
    this.ontimeout = fn
    this.context = ctx
    this.interval = interval
    this.done = false

    this._timer = interval
      ? setInterval(callInterval, ms, this)
      : setTimeout(callTimeout, ms, this)
  }

  unref () {
    this._timer.unref()
  }

  ref () {
    this._timer.ref()
  }

  refresh () {
    if (this.done !== true) this._timer.refresh()
  }

  destroy () {
    this.done = true
    this.ontimeout = null
    if (this.interval) clearInterval(this._timer)
    else clearTimeout(this._timer)
  }

  static once (ms, fn, ctx) {
    return new this(ms, fn, ctx, false)
  }

  static on (ms, fn, ctx) {
    return new this(ms, fn, ctx, true)
  }
}

function callTimeout (self) {
  self.done = true
  self.ontimeout.call(self.context)
}

function callInterval (self) {
  self.ontimeout.call(self.context)
}
