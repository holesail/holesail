const { Readable } = require('streamx')
const b4a = require('b4a')
const peer = require('./peer')
const { DOWN_HINT } = require('./commands')

const DONE = []
const DOWN = []

module.exports = class Query extends Readable {
  constructor (dht, target, internal, command, value, opts = {}) {
    super()

    this.dht = dht
    this.k = this.dht.table.k
    this.target = target
    this.internal = internal
    this.command = command
    this.value = value
    this.errors = 0
    this.successes = 0
    this.concurrency = opts.concurrency || this.dht.concurrency
    this.inflight = 0
    this.map = opts.map || defaultMap
    this.maxSlow = opts.maxSlow === 0 ? 0 : (opts.maxSlow || 5)
    this.closestReplies = []

    this._slow = 0
    this._online = false
    this._slowdown = false
    this._seen = new Map()
    this._pending = []
    this._fromTable = false
    this._commit = opts.commit === true ? autoCommit : (opts.commit || null)
    this._commiting = false
    this._session = opts.session || dht.session()
    this._autoDestroySession = !opts.session
    this._onlyClosestNodes = false

    this._onvisitbound = this._onvisit.bind(this)
    this._onerrorbound = this._onerror.bind(this)
    this._oncyclebound = this._oncycle.bind(this)

    const nodes = opts.nodes || opts.closestNodes
    const replies = opts.replies || opts.closestReplies

    // add them reverse as we pop below
    if (nodes) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i]
        this._addPending({ id: node.id || peer.id(node.host, node.port), host: node.host, port: node.port }, null)
      }
    } else if (replies) {
      for (let i = replies.length - 1; i >= 0; i--) {
        this._addPending(replies[i].from, null)
      }
    }

    if (opts.onlyClosestNodes) this._onlyClosestNodes = true
  }

  get closestNodes () {
    const nodes = new Array(this.closestReplies.length)

    for (let i = 0; i < nodes.length; i++) {
      nodes[i] = this.closestReplies[i].from
    }

    return nodes
  }

  finished () {
    return new Promise((resolve, reject) => {
      const self = this
      let error = null

      this.resume()
      this.on('error', onerror)
      this.on('close', onclose)

      function onclose () {
        self.removeListener('error', onerror)
        self.removeListener('close', onclose)
        if (error) reject(error)
        else resolve()
      }

      function onerror (err) {
        error = err
      }
    })
  }

  _addFromTable () {
    if (this._pending.length >= this.k) return
    this._fromTable = true

    const closest = this.dht.table.closest(this.target, this.k - this._pending.length)

    for (const node of closest) {
      this._addPending({ id: node.id, host: node.host, port: node.port }, null)
    }
  }

  async _open (cb) {
    this._addFromTable()
    if (this._pending.length >= this.k) return cb(null)

    for await (const node of this.dht._resolveBootstrapNodes()) {
      this._addPending(node, null)
    }

    cb(null)
  }

  _isCloser (id) {
    return this.closestReplies.length < this.k || this._compare(id, this.closestReplies[this.closestReplies.length - 1].from.id) < 0
  }

  _addPending (node, ref) {
    if (this._onlyClosestNodes) return false

    const addr = node.host + ':' + node.port
    const refs = this._seen.get(addr)
    const isCloser = this._isCloser(node.id)

    if (refs === DONE) {
      return isCloser
    }

    if (refs === DOWN) {
      if (ref) this._downHint(ref, node)
      return isCloser
    }

    if (refs) {
      if (ref !== null) refs.push(ref)
      return isCloser
    }

    if (!isCloser) {
      return false
    }

    this._seen.set(addr, ref === null ? [] : [ref])
    this._pending.push(node)

    return true
  }

  _read (cb) {
    this._readMore()
    cb(null)
  }

  _readMore () {
    if (this.destroying || this._commiting) return

    const concurrency = (this._slowdown ? 3 : this.concurrency) + this._slow

    while (this.inflight < concurrency && this._pending.length > 0) {
      const next = this._pending.pop()
      if (next && next.id && !this._isCloser(next.id)) continue
      this._visit(next)
    }

    // if reusing closest nodes, slow down after the first readMore tick to allow
    // the closest node a chance to reply before going broad to question more
    if (!this._fromTable && this.successes === 0 && this.errors === 0) {
      this._slowdown = true
    }

    if (this._pending.length > 0) return

    // if no inflight OR all the queries we are waiting on are marked as slow (within our limits) and we have a full result.
    if (this.inflight === 0 || (this._slow <= this.maxSlow && this._slow === this.inflight && this.closestReplies.length >= this.k)) {
      // if more than 3/4 failed and we only used cached nodes, try again from the routing table
      if (!this._fromTable && this.successes < this.k / 4) {
        this._addFromTable()
        this._readMore()
        return
      }

      this._flush()
    }
  }

  _flush () {
    if (this._commiting) return
    this._commiting = true

    if (this._commit === null) {
      this.push(null)
      return
    }

    const p = []
    for (const m of this.closestReplies) p.push(this._commit(m, this.dht, this))
    this._endAfterCommit(p)
  }

  _endAfterCommit (ps) {
    if (!ps.length) {
      this.destroy(new Error('Too few nodes responded'))
      return
    }

    const self = this

    let pending = ps.length
    let success = 0

    for (const p of ps) p.then(ondone, onerror)

    function ondone () {
      success++
      if (--pending === 0) self.push(null)
    }

    function onerror (err) {
      if (--pending > 0) return
      if (success) self.push(null)
      else self.destroy(err)
    }
  }

  _dec (req) {
    if (req.oncycle === noop) {
      this._slow--
    } else {
      req.oncycle = noop
    }
    this.inflight--
  }

  _onvisit (m, req) {
    this._dec(req)

    this._online = true
    if (!this.dht.online) this.dht._online()

    const addr = req.to.host + ':' + req.to.port
    this._seen.set(addr, DONE)

    if (this._commiting) return

    if (m.error === 0) this.successes++
    else this.errors++

    if (m.error === 0 && m.from.id !== null && this._isCloser(m.from.id)) this._pushClosest(m)

    if (m.closerNodes !== null) {
      for (const node of m.closerNodes) {
        node.id = peer.id(node.host, node.port)
        if (this.dht._shouldAddNode !== null && !this.dht._shouldAddNode(node)) continue
        if (b4a.equals(node.id, this.dht.table.id)) continue
        // TODO: we could continue here instead of breaking to ensure that one of the nodes in the closer list
        // is later marked as DOWN that we gossip that back
        if (!this._addPending(node, m.from)) break
      }
    }

    if (!this._fromTable && this.successes + this.errors >= this.concurrency) {
      this._slowdown = false
    }

    if (m.error !== 0) {
      this._readMore()
      return
    }

    const data = this.map(m)
    if (!data || this.push(data) !== false) {
      this._readMore()
    }
  }

  _onerror (_, req) {
    const addr = req.to.host + ':' + req.to.port
    const refs = this._seen.get(addr)

    this._seen.set(addr, DOWN)
    for (const node of refs) this._downHint(node, req.to)

    this._dec(req)
    this.errors++
    this._readMore()
  }

  _oncycle (req) {
    req.oncycle = noop
    this._slow++
    this._readMore()
  }

  _downHint (node, down) {
    const state = { start: 0, end: 6, buffer: b4a.allocUnsafe(6) }
    peer.ipv4.encode(state, down)
    this.dht._request(node, true, DOWN_HINT, null, state.buffer, this._session, noop, noop)
  }

  _pushClosest (m) {
    this.closestReplies.push(m)
    for (let i = this.closestReplies.length - 2; i >= 0; i--) {
      const prev = this.closestReplies[i]
      const cmp = this._compare(prev.from.id, m.from.id)
      // if sorted, done!
      if (cmp < 0) break
      // if dup, splice it out (rare)
      if (cmp === 0) {
        this.closestReplies.splice(i + 1, 1)
        break
      }
      // swap and continue down
      this.closestReplies[i + 1] = prev
      this.closestReplies[i] = m
    }
    if (this.closestReplies.length > this.k) this.closestReplies.pop()
  }

  _compare (a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue
      const t = this.target[i]
      return (t ^ a[i]) - (t ^ b[i])
    }
    return 0
  }

  _visit (to) {
    this.inflight++

    const req = this.dht._request(to, this.internal, this.command, this.target, this.value, this._session, this._onvisitbound, this._onerrorbound)
    if (req === null) {
      this.destroy(new Error('Node was destroyed'))
      return
    }
    req.oncycle = this._oncyclebound
  }

  _destroy (cb) {
    if (!this._online && this.dht.online) this.dht._offline()
    if (this._autoDestroySession) this._session.destroy()
    cb(null)
  }
}

function autoCommit (reply, dht, query) {
  if (!reply.token) return Promise.reject(new Error('No token received for closest node'))
  return dht.request({ token: reply.token, target: query.target, command: query.command, value: query.value }, reply.from)
}

function defaultMap (m) {
  return m
}

function noop () {}
