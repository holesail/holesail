const events = require('events')
const b4a = require('b4a')
const binding = require('../binding')

module.exports = class NetworkInterfaces extends events.EventEmitter {
  constructor () {
    super()

    this._handle = b4a.allocUnsafe(binding.sizeof_udx_napi_interface_event_t)
    this._watching = false
    this._destroying = null

    binding.udx_napi_interface_event_init(this._handle, this,
      this._onevent,
      this._onclose
    )

    this.interfaces = binding.udx_napi_interface_event_get_addrs(this._handle)
  }

  _onclose () {
    this.emit('close')
  }

  _onevent () {
    this.interfaces = binding.udx_napi_interface_event_get_addrs(this._handle)

    this.emit('change', this.interfaces)
  }

  watch () {
    if (this._watching) return this
    this._watching = true

    binding.udx_napi_interface_event_start(this._handle)

    return this
  }

  unwatch () {
    if (!this._watching) return this
    this._watching = false

    binding.udx_napi_interface_event_stop(this._handle)

    return this
  }

  async destroy () {
    if (this._destroying) return this._destroying
    this._destroying = events.once(this, 'close')

    binding.udx_napi_interface_event_close(this._handle)

    return this._destroying
  }

  [Symbol.iterator] () {
    return this.interfaces[Symbol.iterator]()
  }
}
