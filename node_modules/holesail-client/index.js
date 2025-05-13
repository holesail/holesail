// Importing required modules
const HyperDHT = require('hyperdht') // HyperDHT module for DHT functionality
const net = require('net') // Net module for creating network clients and servers
const libNet = require('@holesail/hyper-cmd-lib-net') // Custom network library
const b4a = require('b4a')
const z32 = require('z32')

class HolesailClient {
  constructor (opts) {
    this.seed = opts.key
    this.secure = opts.secure || false

    if (this.secure) {
      this.keyPair = HyperDHT.keyPair(z32.decode(this.seed))
      this.publicKey = this.keyPair.publicKey
    } else {
      this.publicKey = z32.decode(this.seed)
    }

    this.dht = new HyperDHT({ keyPair: this.keyPair })
    this.stats = {}
  }

  async connect (options = {}, callback) {
    let dhtData = {}
    const dhtValue = await this.get()
    if (dhtValue) {
      dhtData = JSON.parse(dhtValue.value)
    }

    options.port = options.port ?? dhtData.port ?? 8989
    options.host = options.host ?? dhtData.host ?? '127.0.0.1'
    options.udp = options.udp ?? dhtData.udp ?? false

    this.args = options
    this.state = 'waiting'
    if (!options.udp) {
      this.handleTCP(options, callback)
    } else {
      this.handleUDP(options, callback)
    }
  } // end connect

  // Handle TCP connections
  handleTCP (options, callback) {
    this.proxy = net.createServer({ allowHalfOpen: true }, (c) => {
      return libNet.connPiper(
        c,
        () => {
          return this.dht.connect(this.publicKey, { reusableSocket: true })
        },
        { compress: false },
        this.stats
      )
    })

    this.proxy.listen(options.port, options.host, () => {
      this.state = 'listening'
      callback?.()
    })
  }

  // Handle UDP connections
  handleUDP (options, callback) {
    const stream = this.dht.connect(this.publicKey)

    stream.once('open', () => {
      libNet.udpPiper(stream, () => {
        return libNet.udpConnect({
          port: options.port,
          host: options.host,
          bind: true
        })
      })

      this.state = 'listening'
      callback?.()
    })
  }

  // resume functionality
  async resume () {
    await this.dht.resume()
    this.state = 'listening'
  }

  async pause () {
    await this.dht.suspend()
    this.state = 'paused'
  }

  async destroy () {
    await this.dht.destroy()
    this.proxy.close()
    this.proxy = null
    this.state = 'destroyed'
  }

  // get mutable record stored on the dht
  async get (opts = {}) {
    const record = await this.dht.mutableGet(this.publicKey, opts)
    if (record) {
      return { seq: record.seq, value: b4a.toString(record.value) }
    }
    return null
  }

  get info () {
    return {
      type: 'client',
      state: this.state,
      secure: this.secure,
      port: this.args.port,
      host: this.args.host,
      protocol: this.args.udp ? 'udp' : 'tcp',
      key: this.seed,
      publicKey: z32.encode(this.publicKey)
    }
  }
} // end client class

module.exports = HolesailClient
