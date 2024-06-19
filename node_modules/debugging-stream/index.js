const { Duplex } = require('streamx')

module.exports = class DebuggingStream extends Duplex {
  constructor (stream, { random = Math.random, latency = 0 } = {}) {
    super()

    this._random = random
    this._latency = toRange(latency)

    this._queued = []
    this._ondrain = null

    this.stream = stream

    let ended = false

    this.stream.on('data', (data) => {
      this._queue({ pending: true, data, error: null, done: false })
    })
    this.stream.on('end', () => {
      ended = true
      this._queue({ pending: true, data: null, error: null, done: false })
    })
    this.stream.on('error', (err) => {
      this._queue({ pending: true, data: null, error: err, done: true })
    })
    this.stream.on('close', () => {
      if (ended) return
      this._queue({ pending: true, data: null, error: null, done: true })
    })
    this.stream.on('drain', () => {
      this._triggerDrain()
    })
  }

  _triggerDrain () {
    if (this._ondrain === null) return
    const ondrain = this._ondrain
    this._ondrain = null
    ondrain()
  }

  _queue (evt) {
    const l = this._latency.start + Math.round(this._random() * this._latency.variance)

    this._queued.push(evt)

    setTimeout(() => {
      evt.pending = false
      this._drain()
    }, l)
  }

  _drain () {
    let paused = false
    while (this._queued.length > 0 && this._queued[0].pending === false) {
      const q = this._queued.shift()

      if (q.done) {
        this.destroy(q.error)
        continue
      }

      if (this.push(q.data) === false) {
        paused = true
      }
    }

    if (paused) this.stream.pause()
  }

  _read (cb) {
    this.stream.resume()
    cb(null)
  }

  _predestroy () {
    this._triggerDrain()
  }

  _write (data, cb) {
    if (this.stream.write(data) === false) {
      this._ondrain = cb
      return
    }
    cb(null)
  }

  _final (cb) {
    this.stream.end()
    cb()
  }
}

function toRange (range) {
  if (typeof range === 'number') {
    range = [range, range]
  }

  return { start: range[0], variance: range[1] - range[0] }
}
