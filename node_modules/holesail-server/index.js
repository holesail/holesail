// Importing required modules
const HyperDHT = require('hyperdht') // HyperDHT module for DHT functionality
const net = require('net') // Node.js net module for creating network clients and servers

const libNet = require('@holesail/hyper-cmd-lib-net') // Custom network library
const libKeys = require('hyper-cmd-lib-keys') // To generate a random preSeed for server seed.
const b4a = require('b4a')
const z32 = require('z32')

class HolesailServer {
  constructor () {
    this.dht = new HyperDHT()
    this.stats = {}
    this.server = null
    this.keyPair = null
    this.seed = null
    this.state = null
    this.connection = null
  }

  generateKeyPair (seed) {
    // Allows us to keep the same keyPair everytime.
    if (!seed) {
      seed = libKeys.randomBytes(32).toString('hex')
    }
    // generate a seed from the buffer key
    this.seed = Buffer.from(seed, 'hex')
    // generate a keypair from the seed
    this.keyPair = HyperDHT.keyPair(this.seed)
    return this.keyPair
  }

  // start the client on port and the address specified
  async start (args, callback) {
    this.args = args
    this.secure = args.secure === true

    // generate the keypair
    this.generateKeyPair(args.seed)
    // this is needed for the secure mode to work and is implemented by HyperDHT
    let privateFirewall = false
    if (this.secure) {
      privateFirewall = (remotePublicKey) => {
        return !b4a.equals(remotePublicKey, this.keyPair.publicKey)
      }
    }

    this.server = this.dht.createServer(
      {
        firewall: privateFirewall,
        reusableSocket: true
      },
      (c) => {
        if (!args.udp) {
          this.handleTCP(c, args)
        } else {
          this.handleUDP(c, args)
        }
      }
    )

    // start listening on the keyPair
    this.server.listen(this.keyPair).then(() => {
      this.state = 'listening'
      if (typeof callback === 'function') {
        callback() // Invoke the callback after the server has started
      }
    })

    // put host information on the dht
    await this.put(
      JSON.stringify({
        host: this.args.host,
        udp: this.args.udp,
        port: this.args.port
      })
    )
  }

  // Handle  TCP connections
  handleTCP (c, args) {
    // Connection handling using custom connection piper function
    this.connection = libNet.connPiper(
      c,
      () => {
        return net.connect({
          port: +args.port,
          host: args.address,
          allowHalfOpen: true
        })
      },
      { isServer: true, compress: false },
      this.stats
    )
  }

  // Handle UDP connections
  handleUDP (c, args) {
    this.connection = libNet.udpPiper(
      c,
      () => {
        return libNet.udpConnect({
          port: +args.port,
          host: args.address
        })
      },
      { isServer: true, compress: false },
      this.stats
    )
  }

  // Return the public/connection key
  get key () {
    if (this.secure) {
      return z32.encode(this.seed)
    } else {
      return z32.encode(this.keyPair.publicKey)
    }
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

  // destroy the dht instance and free up resources
  async destroy () {
    if (this.dht) await this.dht.destroy()
    this.dht = null
    if (this.server) this.server = null
    if (this.connection) this.connection = null
    this.state = 'destroyed'
  }

  // put a mutable record on the dht, can be retrieved by any client using the keypair, max limit is 1KB
  async put (data, opts = {}) {
    data = b4a.isBuffer(data) ? data : Buffer.from(data)

    if (opts.seq) {
      await this.dht.mutablePut(this.keyPair, data, opts)
      return opts.seq
    }

    const oldRecord = await this.get({ latest: true })
    if (!oldRecord) {
      const { seq } = await this.dht.mutablePut(this.keyPair, data, opts)
      return seq
    } else if (oldRecord.value === b4a.toString(data)) {
      return oldRecord.seq
    } else {
      opts.seq = oldRecord.seq + 1
      await this.dht.mutablePut(this.keyPair, data, opts)
      return opts.seq
    }
  }

  // get mutable record from dht
  async get (opts = {}) {
    const record = await this.dht.mutableGet(this.keyPair.publicKey, opts)
    if (record) {
      return { seq: record.seq, value: b4a.toString(record.value) }
    }
    return null
  }

  // return information about the server
  get info () {
    return {
      type: 'server',
      state: this.state,
      secure: this.secure,
      port: this.args.port,
      host: this.args.host,
      protocol: this.args.udp ? 'udp' : 'tcp',
      seed: this.args.seed,
      key: this.key,
      publicKey: z32.encode(this.keyPair.publicKey)
    }
  }
}

module.exports = HolesailServer
