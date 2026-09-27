const ReadyResource = require('ready-resource')
const HolesailClient = require('holesail-client')
const HolesailServer = require('holesail-server')
const HyperDHT = require('hyperdht')
const { randomSeed } = require('@holesail/invite')

class Holesail extends ReadyResource {
  constructor(opts = {}) {
    super()
    this.server = opts.server || false
    this.client = opts.client || false

    this.port = opts.port
    this.host = opts.host
    this.udp = opts.udp

    this.invite = opts.invite || null
    this.seed = opts.seed || null
    this.logger = opts.logger

    this.bootstrap = opts.bootstrap || null

    this.dht = null
    this.running = false
  }

  static async probe(invite) {
    return await HolesailClient.probe(invite)
  }

  static randomSeed() {
    return randomSeed()
  }

  async _open() {
    if (this.running) return
    if (this.server) {
      const opts = {
        port: this.port,
        host: this.host,
        udp: this.udp,
        seed: this.seed,
        logger: this.logger,
        bootstrap: this.bootstrap === false ? false : this.bootstrap || HyperDHT.BOOTSTRAP
      }
      this.dht = new HolesailServer(opts)
    } else {
      const opts = {
        port: this.port,
        host: this.host,
        udp: this.udp,
        invite: this.invite,
        logger: this.logger,
        bootstrap: this.bootstrap
      }
      this.dht = new HolesailClient(opts)
    }
    this._emit()
    await this.dht.ready()
    this.running = true
  }

  _emit() {
    this.dht.on('listening', () => this.emit('listening'))

    if (this.server) {
      this.dht.on('connection', () => this.emit('connection'))
    } else {
      this.dht.on('connect', () => this.emit('connect'))
    }
  }

  async pause() {
    await this.dht.pause()
  }

  async resume() {
    await this.dht.resume()
  }

  get info() {
    const dhtInfo = this.dht.info
    const info = {
      server: this.server,
      client: this.client,
      state: dhtInfo.state,
      port: dhtInfo.port,
      host: dhtInfo.host,
      udp: dhtInfo.udp,
      seed: dhtInfo.seed,
      invite: dhtInfo.invite
    }

    if (this.server) info.seed = this.seed
    return info
  }

  async _close() {
    await this.dht.close()
    this.running = false
  }
}

// eslint-disable-next-line no-unused-vars
function noop() {}

module.exports = Holesail
