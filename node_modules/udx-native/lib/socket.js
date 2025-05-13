const events = require('events')
const b4a = require('b4a')
const binding = require('../binding')
const ip = require('./ip')

module.exports = class UDXSocket extends events.EventEmitter {
  constructor (udx, opts = {}) {
    super()

    this.udx = udx

    this._handle = b4a.allocUnsafe(binding.sizeof_udx_napi_socket_t)
    this._inited = false
    this._host = null
    this._family = 0
    this._ipv6Only = opts.ipv6Only === true
    this._reuseAddress = opts.reuseAddress === true
    this._port = 0
    this._reqs = []
    this._free = []
    this._closing = null
    this._closed = false

    this._view64 = new BigUint64Array(this._handle.buffer, this._handle.byteOffset, this._handle.byteLength >> 3)

    this.streams = new Set()

    this.userData = null
  }

  get bound () {
    return this._port !== 0
  }

  get closing () {
    return this._closing !== null
  }

  get idle () {
    return this.streams.size === 0
  }

  get busy () {
    return this.streams.size > 0
  }

  get bytesTransmitted () {
    if (this._inited !== true) return 0
    return Number(this._view64[binding.offsetof_udx_socket_t_bytes_tx >> 3])
  }

  get packetsTransmitted () {
    if (this._inited !== true) return 0
    return Number(this._view64[binding.offsetof_udx_socket_t_packets_tx >> 3])
  }

  get bytesReceived () {
    if (this._inited !== true) return 0
    return Number(this._view64[binding.offsetof_udx_socket_t_bytes_rx >> 3])
  }

  get packetsReceived () {
    if (this._inited !== true) return 0
    return Number(this._view64[binding.offsetof_udx_socket_t_packets_rx >> 3])
  }

  get packetsDroppedByKernel () {
    if (this._inited !== true) return 0
    return Number(this._view64[binding.offsetof_udx_socket_t_packets_dropped_by_kernel >> 3])
  }

  toJSON () {
    return {
      bound: this.bound,
      closing: this.closing,
      streams: this.streams.size,
      address: this.address(),
      ipv6Only: this._ipv6Only,
      reuseAddress: this._reuseAddress,
      idle: this.idle,
      busy: this.busy
    }
  }

  _init () {
    if (this._inited) return

    binding.udx_napi_socket_init(this.udx._handle, this._handle, this,
      this._onsend,
      this._onmessage,
      this._onclose,
      this._reallocMessage
    )

    this._inited = true
  }

  _onsend (id, err) {
    const req = this._reqs[id]

    const onflush = req.onflush

    req.buffer = null
    req.onflush = null

    this._free.push(id)

    onflush(err >= 0)

    // gc the free list
    if (this._free.length >= 16 && this._free.length === this._reqs.length) {
      this._free = []
      this._reqs = []
    }
  }

  _onmessage (len, port, host, family) {
    this.emit('message', this.udx._consumeMessage(len), { host, family, port })
    return this.udx._buffer
  }

  _onclose () {
    this.emit('close')
  }

  _reallocMessage () {
    return this.udx._reallocMessage()
  }

  _onidle () {
    this.emit('idle')
  }

  _onbusy () {
    this.emit('busy')
  }

  _addStream (stream) {
    if (this.streams.has(stream)) return false
    this.streams.add(stream)
    if (this.streams.size === 1) this._onbusy()
    return true
  }

  _removeStream (stream) {
    if (!this.streams.has(stream)) return false
    this.streams.delete(stream)
    const closed = this._closeMaybe()
    if (this.idle && !closed) this._onidle()
    return true
  }

  address () {
    if (!this.bound) return null
    return { host: this._host, family: this._family, port: this._port }
  }

  bind (port, host) {
    if (this.bound) throw new Error('Already bound')
    if (this.closing) throw new Error('Socket is closed')

    if (!port) port = 0

    let flags = 0
    if (this._ipv6Only) flags |= binding.UV_UDP_IPV6ONLY
    if (this._reuseAddress) flags |= binding.UV_UDP_REUSEADDR

    let family

    if (host) {
      family = ip.isIP(host)
      if (!family) throw new Error(`${host} is not a valid IP address`)

      if (!this._inited) this._init()

      this._port = binding.udx_napi_socket_bind(this._handle, port, host, family, flags)
    } else {
      if (!this._inited) this._init()

      try {
        host = '::'
        family = 6
        this._port = binding.udx_napi_socket_bind(this._handle, port, host, family, flags)
      } catch {
        host = '0.0.0.0'
        family = 4
        this._port = binding.udx_napi_socket_bind(this._handle, port, host, family, flags)
      }
    }

    this._host = host
    this._family = family

    this.emit('listening')
  }

  async close () {
    if (this._closing) return this._closing
    this._closing = new Promise(resolve => this.once('close', resolve))
    this._closeMaybe()
    return this._closing
  }

  _closeMaybe () {
    if (this._closed || this._closing === null) return this._closed

    if (!this._inited) {
      this._closed = true
      this.emit('close')
      return true
    }

    if (this.idle) {
      binding.udx_napi_socket_close(this._handle)
      this._closed = true
    }

    return this._closed
  }

  setTTL (ttl) {
    if (!this._inited) throw new Error('Socket not active')
    binding.udx_napi_socket_set_ttl(this._handle, ttl)
  }

  getRecvBufferSize () {
    if (!this._inited) throw new Error('Socket not active')
    return binding.udx_napi_socket_get_recv_buffer_size(this._handle)
  }

  setRecvBufferSize (size) {
    if (!this._inited) throw new Error('Socket not active')
    return binding.udx_napi_socket_set_recv_buffer_size(this._handle, size)
  }

  getSendBufferSize () {
    if (!this._inited) throw new Error('Socket not active')
    return binding.udx_napi_socket_get_send_buffer_size(this._handle)
  }

  setSendBufferSize (size) {
    if (!this._inited) throw new Error('Socket not active')
    return binding.udx_napi_socket_set_send_buffer_size(this._handle, size)
  }

  addMembership (group, ifaceAddress) {
    if (!this._inited) throw new Error('Socket not active')
    return binding.udx_napi_socket_set_membership(this._handle, group, ifaceAddress || '', true)
  }

  dropMembership (group, ifaceAddress) {
    if (!this._inited) throw new Error('Socket not active')
    return binding.udx_napi_socket_set_membership(this._handle, group, ifaceAddress || '', false)
  }

  async send (buffer, port, host, ttl) {
    if (this.closing) return false

    if (!host) host = '127.0.0.1'

    const family = ip.isIP(host)
    if (!family) throw new Error(`${host} is not a valid IP address`)

    if (!this.bound) this.bind(0)

    const id = this._allocSend()
    const req = this._reqs[id]

    req.buffer = buffer

    const promise = new Promise((resolve) => {
      req.onflush = resolve
    })

    binding.udx_napi_socket_send_ttl(this._handle, req.handle, id, buffer, port, host, family, ttl || 0)

    return promise
  }

  trySend (buffer, port, host, ttl) {
    if (this.closing) return

    if (!host) host = '127.0.0.1'

    const family = ip.isIP(host)
    if (!family) throw new Error(`${host} is not a valid IP address`)

    if (!this.bound) this.bind(0)

    const id = this._allocSend()
    const req = this._reqs[id]

    req.buffer = buffer
    req.onflush = noop

    binding.udx_napi_socket_send_ttl(this._handle, req.handle, id, buffer, port, host, family, ttl || 0)
  }

  _allocSend () {
    if (this._free.length > 0) return this._free.pop()
    const handle = b4a.allocUnsafe(binding.sizeof_udx_socket_send_t)
    return this._reqs.push({ handle, buffer: null, onflush: null }) - 1
  }
}

function noop () {}
