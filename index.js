const ReadyResource = require('ready-resource')
const HolesailServer = require('holesail-server')
const HolesailClient = require('holesail-client')
const goodbye = require('graceful-goodbye')
const b4a = require('b4a')
const { runtime } = require('which-runtime')
let createHash
if (runtime === 'bare') {
  createHash = require('bare-crypto').createHash
} else {
  createHash = require('node:crypto').createHash
}

const libKeys = require('hyper-cmd-lib-keys') // generate a random seed
class Holesail extends ReadyResource {
  constructor (opts = {}) {
    super()

    this.verifyOpts(opts)

    this.server = opts.mode === 'server'
    this.seed = opts.seed
    this.connector = opts.key
    this.udp = opts.udp || false
    this.port = opts.port || 8989
    this.host = opts.host || '127.0.0.1'
    this.protocol = opts.protocol === 'udp' ? 'udp' : 'tcp'
    this.secure = opts.secure
    this.dht = null
    this.running = false
  }

  #initialiseKey (key) {
    if (this.server) {
      return this.seed ? createHash('sha256').update(this.seed.toString()).digest('hex') : null
    } else {
      return this.secure ? b4a.toString(Buffer.from(createHash('sha256').update(key.toString()).digest('hex'), 'hex'), 'hex') : key
    }
  }

  get key () {
    if (this.server) {
      return this.secure ? this.seed : this.dht.getPublicKey()
    } else {
      return this.connector
    }
  }

  async _open () {
    if (this.server) {
      this.dht = new HolesailServer()
    } else {
      this.dht = new HolesailClient(this.#initialiseKey(this.connector), this.secure)
    }
  }

  async connect (callback) {
    await this.ready()
    if (this.running) throw new Error('Already connected')

    if (this.server) {
      this.#handleServer(callback)
    } else {
      this.#handleClient(callback)
    }

    this.running = true
  }

  #handleServer (callback) {
    this.dht.serve({
      port: this.port,
      address: this.host,
      buffSeed: this.#initialiseKey(this.seed),
      secure: this.secure,
      udp: this.udp
    }, callback)
  }

  #handleClient (callback) {
    this.dht.connect({ port: this.port, address: this.host, udp: this.udp }, callback)
  }

  verifyOpts (opts) {
    if (opts.mode === 'client' && !opts.key) {
      throw new Error('Connection string not set for client')
    }

    if (opts.protocol !== undefined && (opts.protocol !== 'udp' && opts.protocol !== 'tcp')) {
      throw new Error('Incorrect protocol set')
    }
  }

  get info () {
    return {
      server: this.server,
      secure: this.secure,
      port: this.port,
      host: this.host,
      key: this.key,
      protocol: this.protocol,
      seed: this.seed
    }
  }

  async _close () {
    this.dht.destroy()
  }
}

function noop () {}

module.exports = Holesail
