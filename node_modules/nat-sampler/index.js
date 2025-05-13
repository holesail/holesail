module.exports = class NatSampler {
  constructor () {
    this.host = null
    this.port = 0
    this.size = 0

    this._a = null
    this._b = null
    this._threshold = 0
    this._top = 0
    this._samples = []
  }

  add (host, port) {
    const a = this._bump(host, port, 2)
    const b = this._bump(host, 0, 1)

    if (this._samples.length < 32) {
      this.size++
      this._threshold = this.size - (this.size < 4 ? 0 : this.size < 8 ? 1 : this.size < 12 ? 2 : 3)
      this._samples.push(a, b)
      this._top += 2
    } else {
      if (this._top === 32) this._top = 0

      const oa = this._samples[this._top]
      this._samples[this._top++] = a
      oa.hits--

      const ob = this._samples[this._top]
      this._samples[this._top++] = b
      ob.hits--
    }

    if (this._a === null || this._a.hits < a.hits) this._a = a
    if (this._b === null || this._b.hits < b.hits) this._b = b

    if (this._a.hits >= this._threshold) {
      this.host = this._a.host
      this.port = this._a.port
    } else if (this._b.hits >= this._threshold) {
      this.host = this._b.host
      this.port = 0
    } else {
      this.host = null
      this.port = 0
    }

    return a.hits
  }

  _bump (host, port, inc) {
    for (let i = 0; i < 4; i++) {
      const j = (this._top - inc - (2 * i)) & 31
      if (j >= this._samples.length) return { host, port, hits: 1 }
      const s = this._samples[j]
      if (s.port === port && s.host === host) {
        s.hits++
        return s
      }
    }
    return { host, port, hits: 1 }
  }
}
