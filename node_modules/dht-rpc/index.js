const { EventEmitter } = require('events')
const Table = require('kademlia-routing-table')
const TOS = require('time-ordered-set')
const UDX = require('udx-native')
const sodium = require('sodium-universal')
const c = require('compact-encoding')
const NatSampler = require('nat-sampler')
const b4a = require('b4a')
const IO = require('./lib/io')
const Query = require('./lib/query')
const Session = require('./lib/session')
const peer = require('./lib/peer')
const { UNKNOWN_COMMAND, INVALID_TOKEN } = require('./lib/errors')
const { PING, PING_NAT, FIND_NODE, DOWN_HINT } = require('./lib/commands')

const TMP = b4a.allocUnsafe(32)
const TICK_INTERVAL = 5000
const SLEEPING_INTERVAL = 3 * TICK_INTERVAL
const STABLE_TICKS = 240 // if nothing major bad happens in ~20mins we can consider this node stable (if nat is friendly)
const MORE_STABLE_TICKS = 3 * STABLE_TICKS
const REFRESH_TICKS = 60 // refresh every ~5min when idle
const RECENT_NODE = 12 // we've heard from a node less than 1min ago
const OLD_NODE = 360 // if an node has been around more than 30 min we consider it old

class DHT extends EventEmitter {
  constructor (opts = {}) {
    super()

    this.bootstrapNodes = opts.bootstrap === false ? [] : (opts.bootstrap || []).map(parseNode)
    this.table = new Table(randomBytes(32))
    this.nodes = new TOS()
    this.udx = opts.udx || new UDX()
    this.io = new IO(this.table, this.udx, {
      ...opts,
      onrequest: this._onrequest.bind(this),
      onresponse: this._onresponse.bind(this),
      ontimeout: this._ontimeout.bind(this)
    })

    this.concurrency = opts.concurrency || 10
    this.bootstrapped = false
    this.ephemeral = true
    this.firewalled = this.io.firewalled
    this.adaptive = typeof opts.ephemeral !== 'boolean' && opts.adaptive !== false
    this.destroyed = false
    this.suspended = false
    this.online = true
    this.stats = {
      queries: { active: 0, total: 0 },
      commands: {
        ping: this.io.stats.commands[PING],
        pingNat: this.io.stats.commands[PING_NAT],
        findNode: this.io.stats.commands[FIND_NODE],
        downHint: this.io.stats.commands[DOWN_HINT]
      }
    }

    this._nat = new NatSampler()
    this._quickFirewall = opts.quickFirewall !== false
    this._forcePersistent = opts.ephemeral === false
    this._repinging = 0
    this._checks = 0
    this._tick = randomOffset(100) // make sure to random offset all the network ticks
    this._refreshTicks = randomOffset(REFRESH_TICKS)
    this._stableTicks = this.adaptive ? STABLE_TICKS : 0
    this._tickInterval = setInterval(this._ontick.bind(this), TICK_INTERVAL)
    this._lastTick = Date.now()
    this._lastHost = null
    this._filterNode = opts.filterNode || opts.addNode || null // opts.addNode is deprecating, use opts.filterNode instead
    this._onrow = (row) => row.on('full', (node) => this._onfullrow(node, row))
    this._nonePersistentSamples = []
    this._bootstrapping = this._bootstrap()
    this._bootstrapping.catch(noop)

    this.table.on('row', this._onrow)

    this.io.networkInterfaces.on('change', (interfaces) => this._onnetworkchange(interfaces))

    if (opts.nodes) {
      for (let i = opts.nodes.length - 1; i >= 0; i--) {
        this.addNode(opts.nodes[i])
      }
    }
  }

  static bootstrapper (port, host, opts) {
    if (!port) throw new Error('Port is required')
    if (!host) throw new Error('Host is required')
    if (host === '0.0.0.0' || host === '::') throw new Error('Invalid host')
    if (!UDX.isIPv4(host)) throw new Error('Host must be a IPv4 address')

    const dht = new this({ port, ephemeral: false, firewalled: false, anyPort: false, bootstrap: [], ...opts })
    dht._nat.add(host, port)
    return dht
  }

  get id () {
    return this.ephemeral ? null : this.table.id
  }

  get host () {
    return this._nat.host
  }

  get port () {
    return this._nat.port
  }

  get randomized () {
    return this._nat.host !== null && (this._nat.port === 0)
  }

  get socket () {
    return this.firewalled ? this.io.clientSocket : this.io.serverSocket
  }

  onmessage (socket, buf, rinfo) {
    if (buf.byteLength > 1) this.io.onmessage(socket, buf, rinfo)
  }

  bind () {
    return this.io.bind()
  }

  async suspend ({ log = noop } = {}) {
    log('Suspending waiting for io bind...')
    await this.io.bind()
    log('Done, continuing')
    if (this.suspended || this.destroyed) return
    this.suspended = true
    clearInterval(this._tickInterval)
    log('Done, suspending io')
    await this.io.suspend({ log })
    log('Done, dht suspended')
    this.emit('suspend')
  }

  async resume ({ log = noop } = {}) {
    if (!this.suspended || this.destroyed) return
    this.suspended = false
    this._tickInterval = setInterval(this._ontick.bind(this), TICK_INTERVAL)
    this._onwakeup()
    log('Resuming io')
    await this.io.resume()
    log('Done, dht resumed')
    this.io.networkInterfaces.on('change', (interfaces) => this._onnetworkchange(interfaces))
    this.refresh()
    this.emit('resume')
  }

  address () {
    const socket = this.socket
    return socket ? socket.address() : null
  }

  localAddress () {
    if (!this.io.serverSocket) return null

    return {
      host: localIP(this.udx),
      port: this.io.serverSocket.address().port
    }
  }

  remoteAddress () {
    if (!this.host) return null
    if (!this.port) return null
    if (this.firewalled) return null
    if (!this.io.serverSocket) return null

    const port = this.io.serverSocket.address().port
    if (port !== this.port) return null

    return {
      host: this.host,
      port
    }
  }

  addNode ({ host, port }) {
    this._addNode({
      id: peer.id(host, port),
      port,
      host,
      token: null,
      to: null,
      sampled: 0,
      added: this._tick,
      pinged: 0,
      seen: 0,
      downHints: 0,
      prev: null,
      next: null
    })
  }

  toArray (opts) {
    const limit = (opts && opts.limit)
    if (limit === 0) return []
    return this.nodes.toArray({ limit, reverse: true }).map(({ host, port }) => ({ host, port }))
  }

  async fullyBootstrapped () {
    return this._bootstrapping
  }

  ready () {
    // Deprecating, use fullyBootstrapped instead (removed on next major)
    return this.fullyBootstrapped()
  }

  findNode (target, opts) {
    if (this.destroyed) throw new Error('Node destroyed')
    this._refreshTicks = REFRESH_TICKS
    return new Query(this, target, true, FIND_NODE, null, opts)
  }

  query ({ target, command, value }, opts) {
    if (this.destroyed) throw new Error('Node destroyed')
    this._refreshTicks = REFRESH_TICKS
    return new Query(this, target, false, command, value || null, opts)
  }

  ping ({ host, port }, opts) {
    let value = null

    if (opts && opts.size && opts.size > 0) value = b4a.alloc(opts.size)

    const req = this.io.createRequest({ id: null, host, port }, null, true, PING, null, value, (opts && opts.session) || null, (opts && opts.ttl))
    return this._requestToPromise(req, opts)
  }

  request ({ token = null, command, target = null, value = null }, { host, port }, opts) {
    const req = this.io.createRequest({ id: null, host, port }, token, false, command, target, value, (opts && opts.session) || null, (opts && opts.ttl))
    return this._requestToPromise(req, opts)
  }

  session () {
    return new Session(this)
  }

  _requestToPromise (req, opts) {
    if (req === null) return Promise.reject(new Error('Node destroyed'))

    if (opts && opts.socket) req.socket = opts.socket
    if (opts && opts.retry === false) req.retries = 0

    return new Promise((resolve, reject) => {
      req.onresponse = resolve
      req.onerror = reject
      req.send()
    })
  }

  async _bootstrap () {
    const self = this

    await Promise.resolve() // wait a tick, so apis can be used from the outside
    await this.io.bind()

    this.emit('listening')

    // TODO: some papers describe more advanced ways of bootstrapping - we should prob look into that

    let first = this.firewalled && this._quickFirewall && !this._forcePersistent
    let testNat = false

    const onlyFirewall = !this._forcePersistent

    for (let i = 0; i < 2; i++) {
      await this._backgroundQuery(this.table.id).on('data', ondata).finished()

      if (this.bootstrapped || (!testNat && !this._forcePersistent)) break
      if (!(await this._updateNetworkState(onlyFirewall))) break
    }

    if (this.bootstrapped) return
    this.bootstrapped = true

    this.emit('ready')

    function ondata (data) {
      // Simple QUICK nat heuristic.
      // If we get ONE positive nat ping before the bootstrap query finishes
      // then we always to a nat test, no matter if we are adaptive...
      // This should be expanded in the future to try more than one node etc, not always hit the first etc
      // If this fails, then nbd, as the onstable hook will pick it up later.

      if (!first) return
      first = false

      const value = b4a.allocUnsafe(2)
      c.uint16.encode({ start: 0, end: 2, buffer: value }, self.io.serverSocket.address().port)

      self._request(data.from, false, true, PING_NAT, null, value, null, () => { testNat = true }, noop)
    }
  }

  refresh () {
    const node = this.table.random()
    this._backgroundQuery(node ? node.id : this.table.id).on('error', noop)
  }

  async destroy () {
    const emitClose = !this.destroyed
    this.destroyed = true
    clearInterval(this._tickInterval)
    await this.io.destroy()
    if (emitClose) this.emit('close')
  }

  _request (to, force, internal, command, target, value, session, onresponse, onerror) {
    const req = this.io.createRequest(to, null, internal, command, target, value, session)
    if (req === null) return null

    req.onresponse = onresponse
    req.onerror = onerror
    req.send(force)

    return req
  }

  _natAdd (host, port) {
    const prevHost = this._nat.host
    const prevPort = this._nat.port

    this._nat.add(host, port)

    if (prevHost === this._nat.host && prevPort === this._nat.port) return

    this.emit('nat-update', this._nat.host, this._nat.port)
  }

  // we don't check that this is a bootstrap node but we limit the sample size to very few nodes, so fine
  _sampleBootstrapMaybe (from, to) {
    if (this._nonePersistentSamples.length >= Math.max(1, this.bootstrapNodes.length)) return
    const id = from.host + ':' + from.port
    if (this._nonePersistentSamples.indexOf(id) > -1) return
    this._nonePersistentSamples.push(id)
    this._natAdd(to.host, to.port)
  }

  _addNodeFromNetwork (sample, from, to) {
    if (this._filterNode !== null && !this._filterNode(from)) {
      return
    }

    if (from.id === null) {
      this._sampleBootstrapMaybe(from, to)
      return
    }

    const oldNode = this.table.get(from.id)

    // refresh it, if we've seen this before
    if (oldNode) {
      if (sample && (oldNode.sampled === 0 || (this._tick - oldNode.sampled) >= OLD_NODE)) {
        oldNode.to = to
        oldNode.sampled = this._tick
        this._natAdd(to.host, to.port)
      }

      oldNode.pinged = oldNode.seen = this._tick
      this.nodes.add(oldNode)
      return
    }

    this._addNode({
      id: from.id,
      port: from.port,
      host: from.host,
      to,
      sampled: 0,
      added: this._tick,
      pinged: this._tick, // last time we interacted with them
      seen: this._tick, // last time we heard from them
      downHints: 0,
      prev: null,
      next: null
    })
  }

  _addNode (node) {
    if (this.nodes.has(node) || b4a.equals(node.id, this.table.id)) return

    node.added = node.pinged = node.seen = this._tick

    if (!this.table.add(node)) return
    this.nodes.add(node)

    if (node.to && node.sampled === 0) {
      node.sampled = this._tick
      this._natAdd(node.to.host, node.to.port)
    }

    this.emit('add-node', node)
  }

  _removeStaleNode (node, lastSeen) {
    if (node.seen <= lastSeen) this._removeNode(node)
  }

  _removeNode (node) {
    if (!this.nodes.has(node)) return

    this.table.remove(node.id)
    this.nodes.remove(node)

    this.emit('remove-node', node)
  }

  _onwakeup () {
    this._tick += 2 * OLD_NODE // bump the tick enough that everything appears old.
    this._tick += 8 - (this._tick & 7) - 2 // triggers a series of pings in two ticks
    this._stableTicks = MORE_STABLE_TICKS
    this._refreshTicks = 1 // triggers a refresh next tick (allow network time to wake up also)
    this._lastHost = null // clear network cache check

    if (this.adaptive) {
      // TODO: re-enable this as soon as we find out why this is over triggering in some edge cases
      // this.firewalled = true
      // this.io.firewalled = true

      if (!this.ephemeral) {
        this.ephemeral = true
        this.io.ephemeral = true
        this.emit('ephemeral')
      }
    }

    this.emit('wakeup')
  }

  _onfullrow (newNode, row) {
    if (!this.bootstrapped || this._repinging >= 3) return

    let oldest = null
    for (const node of row.nodes) {
      if (node.pinged === this._tick) continue
      if (oldest === null || oldest.pinged > node.pinged || (oldest.pinged === node.pinged && oldest.added > node.added)) oldest = node
    }

    if (oldest === null) return
    if ((this._tick - oldest.pinged) < RECENT_NODE && (this._tick - oldest.added) > OLD_NODE) return

    this._repingAndSwap(newNode, oldest)
  }

  _onnetworkchange (interfaces) {
    this.emit('network-change', interfaces)
    this.emit('network-update')
  }

  _repingAndSwap (newNode, oldNode) {
    const self = this
    const lastSeen = oldNode.seen

    oldNode.pinged = this._tick

    this._repinging++
    this._request({ id: null, host: oldNode.host, port: oldNode.port }, false, true, PING, null, null, null, onsuccess, onswap)

    function onsuccess (m) {
      if (oldNode.seen <= lastSeen) return onswap()
      self._repinging--
    }

    function onswap (e) {
      self._repinging--
      self._removeNode(oldNode)
      self._addNode(newNode)
    }
  }

  _onrequest (req, external) {
    if (req.from.id !== null) {
      this._addNodeFromNetwork(!external, req.from, req.to)
    }

    if (req.internal) {
      switch (req.command) {
        // standard keep alive call
        case PING: {
          req.sendReply(0, null, false, false)
          return
        }
        // check if the other side can receive a message to their other socket
        case PING_NAT: {
          if (req.value === null || req.value.byteLength < 2) return
          const port = c.uint16.decode({ start: 0, end: 2, buffer: req.value })
          if (port === 0) return
          req.from.port = port
          req.sendReply(0, null, false, false)
          return
        }
        // empty dht reply back
        case FIND_NODE: {
          if (!req.target) return
          req.sendReply(0, null, false, true)
          return
        }
        // "this is node you sent me is down" - let's try to ping it
        case DOWN_HINT: {
          if (req.value === null || req.value.byteLength < 6) return
          if (this._checks < 10) {
            sodium.crypto_generichash(TMP, req.value.subarray(0, 6))
            const node = this.table.get(TMP)
            if (node && (node.pinged < this._tick || node.downHints === 0)) {
              node.downHints++
              this._check(node)
            }
          }
          req.sendReply(0, null, false, false)
          return
        }
      }

      req.sendReply(UNKNOWN_COMMAND, null, false, req.target !== null)
      return
    }

    // ask the user to handle it or reply back with a bad command
    if (this.onrequest(req) === false) {
      req.sendReply(UNKNOWN_COMMAND, null, false, req.target !== null)
    }
  }

  onrequest (req) {
    return this.emit('request', req)
  }

  _onresponse (res, external) {
    this._addNodeFromNetwork(!external, res.from, res.to)
  }

  _ontimeout (req) {
    if (!req.to.id) return
    const node = this.table.get(req.to.id)
    if (node) this._removeNode(node)
  }

  _pingSome () {
    let cnt = this.io.inflight.length > 2 ? 3 : 5
    let oldest = this.nodes.oldest

    // tiny dht, pinged the bootstrap again
    if (!oldest) {
      this.refresh()
      return
    }

    // we've recently pinged the oldest one, so only trigger a couple of repings
    if ((this._tick - oldest.pinged) < RECENT_NODE) {
      cnt = 2
    }

    while (cnt--) {
      if (!oldest || this._tick === oldest.pinged) continue
      this._check(oldest)
      oldest = oldest.next
    }
  }

  _check (node) {
    node.pinged = this._tick

    const lastSeen = node.seen
    const onresponse = () => {
      this._checks--
      this._removeStaleNode(node, lastSeen)
    }
    const onerror = () => {
      this._checks--
      this._removeNode(node)
    }

    this._checks++
    this._request({ id: null, host: node.host, port: node.port }, false, true, PING, null, null, null, onresponse, onerror)
  }

  _ontick () {
    const time = Date.now()

    if (time - this._lastTick > SLEEPING_INTERVAL && this.suspended === false) {
      this._onwakeup()
    } else {
      this._tick++
    }

    this._lastTick = time

    if (!this.bootstrapped || this.suspended) return

    if (this.adaptive && this.ephemeral && --this._stableTicks <= 0) {
      if (this._lastHost === this._nat.host) { // do not recheck the same network...
        this._stableTicks = MORE_STABLE_TICKS
      } else {
        this._updateNetworkState() // the promise returned here never fails so just ignore it
      }
    }

    if ((this._tick & 7) === 0) {
      this._pingSome()
    }

    if (((this._tick & 63) === 0 && this.nodes.length < this.table.k) || --this._refreshTicks <= 0) {
      this.refresh()
    }
  }

  async _updateNetworkState (onlyFirewall = false) {
    if (!this.ephemeral) return false
    if (onlyFirewall && !this.firewalled) return false

    const { host, port } = this._nat

    if (!onlyFirewall) {
      // remember what host we checked and reset the counter
      this._stableTicks = MORE_STABLE_TICKS
      this._lastHost = host
    }

    // check if we have a consistent host and port
    if (host === null || port === 0) {
      return false
    }

    const natSampler = this.firewalled ? new NatSampler() : this._nat

    // ask remote nodes to ping us on our server socket to see if we have the port open
    const firewalled = this.firewalled && await this._checkIfFirewalled(natSampler)
    if (firewalled) return false

    this.firewalled = this.io.firewalled = false

    // incase it's called in parallel for some reason, or if our nat status somehow changed
    if (!this.ephemeral || host !== this._nat.host || port !== this._nat.port) return false
    // if the firewall probe returned a different host / non consistent port, bail as well
    if (natSampler.host !== host || natSampler.port === 0) return false

    const id = peer.id(natSampler.host, natSampler.port)

    if (!onlyFirewall) {
      this.ephemeral = this.io.ephemeral = false
    }

    if (natSampler !== this._nat) {
      const prevHost = this._nat.host
      const prevPort = this._nat.port

      this._nonePersistentSamples = []
      this._nat = natSampler

      if (prevHost !== this._nat.host || prevPort !== this._nat.port) {
        this.emit('nat-update', this._nat.host, this._nat.port)
      }
    }

    // TODO: we should make this a bit more defensive in terms of using more
    // resources to make sure that the new routing table contains as many alive nodes
    // as possible, vs blindly copying them over...

    // all good! copy over the old routing table to the new one
    if (!b4a.equals(this.table.id, id)) {
      const nodes = this.table.toArray()

      this.table = this.io.table = new Table(id)

      for (const node of nodes) {
        if (b4a.equals(node.id, id)) continue
        if (!this.table.add(node)) this.nodes.remove(node)
      }

      this.table.on('row', this._onrow)

      // we need to rebootstrap/refresh since we updated our id
      if (this.bootstrapped) this.refresh()
    }

    if (!this.ephemeral) {
      this.emit('persistent')
    }

    return true
  }

  async * _resolveBootstrapNodes () {
    for (let { host, port } of this.bootstrapNodes) {
      let doLookup = false

      if (host.indexOf('@') === -1) {
        doLookup = true
      } else {
        const [suggestedIP, fallbackHost] = host.split('@')
        try {
          await this.ping({ host: suggestedIP, port })
          host = suggestedIP
        } catch {
          host = fallbackHost
          doLookup = true
        }
      }

      if (doLookup) {
        try {
          host = UDX.isIPv4(host) ? host : (await this.udx.lookup(host, { family: 4 })).host
        } catch {
          continue
        }
      }

      yield {
        id: peer.id(host, port),
        host,
        port
      }
    }
  }

  async _addBootstrapNodes (nodes) {
    for await (const node of this._resolveBootstrapNodes()) {
      nodes.push(node)
    }
  }

  async _checkIfFirewalled (natSampler = new NatSampler()) {
    const nodes = []
    for (let node = this.nodes.latest; node && nodes.length < 5; node = node.prev) {
      nodes.push(node)
    }

    if (nodes.length < 5) await this._addBootstrapNodes(nodes)
    // if no nodes are available, including bootstrappers - bail
    if (nodes.length === 0) return true

    const hosts = new Set()
    const value = b4a.allocUnsafe(2)

    c.uint16.encode({ start: 0, end: 2, buffer: value }, this.io.serverSocket.address().port)

    // double check they actually came on the server socket...
    this.io.serverSocket.on('message', onmessage)

    const pongs = await requestAll(this, true, PING_NAT, value, nodes)

    let count = 0
    for (const res of pongs) {
      if (hosts.has(res.from.host)) {
        count++
        natSampler.add(res.to.host, res.to.port)
      }
    }

    this.io.serverSocket.removeListener('message', onmessage)

    // if we got no or very few replies, consider it a fluke
    if (count < (nodes.length >= 5 ? 3 : 1)) return true

    // check that the server socket has the same ip as the client socket
    if (natSampler.host === null || this._nat.host !== natSampler.host) return true

    // check that the local port of the server socket is the same as the remote port
    // TODO: we might want a flag to opt out of this heuristic for specific remapped port servers
    if (natSampler.port === 0 || natSampler.port !== this.io.serverSocket.address().port) return true

    return false

    function onmessage (_, { host }) {
      hosts.add(host)
    }
  }

  _backgroundQuery (target) {
    this._refreshTicks = REFRESH_TICKS

    const backgroundCon = Math.min(this.concurrency, Math.max(2, (this.concurrency / 8) | 0))
    const q = new Query(this, target, true, FIND_NODE, null, { concurrency: backgroundCon, maxSlow: 0 })

    q.on('data', () => {
      // yield to other traffic
      q.concurrency = this.io.inflight.length < 3
        ? this.concurrency
        : backgroundCon
    })

    return q
  }

  // called by the query
  _online () {
    if (this.online) return
    this.online = true
    this.emit('network-update')
  }

  // called by the query
  _offline () {
    if (!this.online) return
    this.online = false
    this.emit('network-update')
  }
}

DHT.OK = 0
DHT.ERROR_UNKNOWN_COMMAND = UNKNOWN_COMMAND
DHT.ERROR_INVALID_TOKEN = INVALID_TOKEN

module.exports = DHT

function localIP (udx, family = 4) {
  let host = null

  for (const n of udx.networkInterfaces()) {
    if (n.family !== family || n.internal) continue

    // mac really likes en0, mb a better way but this shouldnt be bad anywhere so return now
    if (n.name === 'en0') return n.host

    // otherwise pick the first non internal host (let the loop continue in case we see en0)
    if (host === null) host = n.host
  }

  return host || (family === 4 ? '127.0.0.1' : '::1')
}

function parseNode (s) {
  if (typeof s === 'object') return s
  if (typeof s === 'number') return { host: '127.0.0.1', port: s }
  const [host, port] = s.split(':')
  if (!port) throw new Error('Bootstrap node format is host:port')

  return {
    host,
    port: Number(port)
  }
}

function randomBytes (n) {
  const b = b4a.alloc(n)
  sodium.randombytes_buf(b)
  return b
}

function randomOffset (n) {
  return n - ((Math.random() * 0.5 * n) | 0)
}

function requestAll (dht, internal, command, value, nodes) {
  let missing = nodes.length
  const replies = []

  return new Promise((resolve) => {
    for (const node of nodes) {
      const req = dht._request(node, false, internal, command, null, value, null, onsuccess, onerror)
      if (!req) return resolve(replies)
    }

    function onsuccess (res) {
      replies.push(res)
      if (--missing === 0) resolve(replies)
    }

    function onerror () {
      if (--missing === 0) resolve(replies)
    }
  })
}

function noop () {}
