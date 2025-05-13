module.exports = class Session {
  constructor (dht) {
    this.dht = dht
    this.inflight = []
  }

  _attach (req) {
    req.index = this.inflight.push(req) - 1
  }

  _detach (req) {
    const i = req.index
    if (i === -1) return
    req.index = -1

    if (i === this.inflight.length - 1) this.inflight.pop()
    else {
      const req = this.inflight[i] = this.inflight.pop()
      req.index = i
    }
  }

  query ({ target, command, value }, opts = {}) {
    return this.dht.query({ target, command, value }, { ...opts, session: this })
  }

  request ({ token, command, target, value }, { host, port }, opts = {}) {
    return this.dht.request({ token, command, target, value }, { host, port }, { ...opts, session: this })
  }

  ping ({ host, port }, opts = {}) {
    return this.dht.ping({ host, port }, { ...opts, session: this })
  }

  destroy (err) {
    while (this.inflight.length) {
      const req = this.inflight[0]
      // prevent destroyed requests from contributing to congestion counts
      this.dht.io.congestion.recv()
      req.destroy(err)
    }
  }
}
