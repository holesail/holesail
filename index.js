const ReadyResource = require('ready-resource')
const HolesailServer = require('holesail-server')
const HolesailClient = require('holesail-client')
const libKeys = require('hyper-cmd-lib-keys')
const z32 = require('z32')

const { validateOpts } = require('./lib/validateInput')

const createHash = require('crypto').createHash

class Holesail extends ReadyResource {
  constructor (opts = {}) {
    super()

    validateOpts(opts)

    this.server = opts.server || false
    this.client = opts.client || false
    this.port = opts.port
    this.host = opts.host

    const data = Holesail.urlParser(opts.key)
    if (data.secure === undefined) {
      this.secure = opts.secure
    } else {
      this.secure = data.secure
    }

    this.key = data.key

    this.udp = opts.udp

    this.dht = null
    this.running = false

    this.#initialise()
  }

  #initialise () {
    if (this.server) {
      if (this.key) {
        this.seed = createHash('sha256').update(this.key.toString()).digest('hex')
      } else if (this.secure) {
        this.key = libKeys.randomBytes(32).toString('hex')
        this.seed = createHash('sha256').update(this.key.toString()).digest('hex')
      }
    } else {
      this.seed = this.secure ? z32.encode(createHash('sha256').update(this.key.toString()).digest()) : this.key
    }
  }

  static urlParser (url) {
    const protocol = 'hs://'
    let key
    let secure

    if (url && url.substring(0, 5) === protocol && url.substring(5, 9).length === 4) {
      key = url.substring(9)
    } else {
      key = url
    }

    if (url && url.substring(5, 6) === 's') {
      secure = true
    }

    return { key, secure }
  }

  static async lookup (url) {
    const { key: keyStr, secure: specifiedSecure } = Holesail.urlParser(url)
    let keyForPing

    const isSecure = specifiedSecure !== undefined ? specifiedSecure : false

    if (isSecure) {
      const seedBuffer = createHash('sha256').update(keyStr).digest()
      keyForPing = z32.encode(seedBuffer)
    } else {
      keyForPing = keyStr
      try {
        z32.decode(keyForPing)
      } catch {
        throw new Error('Invalid key format.')
      }
    }

    return await HolesailClient.ping(keyForPing)
  }

  async _open () {
    if (this.server) {
      this.dht = new HolesailServer()
      await this.connect()
    } else {
      this.dht = new HolesailClient({ key: this.seed, secure: this.secure })
      await this.connect()
    }
  }

  async connect () {
    if (this.running) throw new Error('Already connected')

    if (this.server) {
      await this.dht.start({ port: this.port, host: this.host, seed: this.seed, secure: this.secure, udp: this.udp })
    } else {
      await this.dht.connect({ port: this.port, host: this.host, udp: this.udp })
    }

    this.running = true
  }

  async pause () {
    await this.dht.pause()
  }

  async resume () {
    await this.dht.resume()
  }

  get info () {
    const info = this.dht.info
    let key
    if (this.key && this.secure) {
      key = this.key
    } else {
      key = info.key
    }

    let url

    if (this.secure) {
      url = 'hs://' + 's000' + key
    } else {
      url = 'hs://' + '0000' + key
    }

    if (this.secure && this.client) {
      const key = this.key
      info.seed = createHash('sha256').update(key.toString()).digest('hex')
    }

    return {
      type: info.type,
      state: info.state,
      secure: info.secure,
      port: info.port,
      host: info.host,
      protocol: info.protocol,
      seed: info.seed,
      key,
      url,
      publicKey: info.publicKey
    }
  }

  async _close () {
    this.dht.destroy()
    this.running = false
  }
}

// eslint-disable-next-line no-unused-vars
function noop () {}

module.exports = Holesail