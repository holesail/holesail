const DHT = require('holesail-server') // Core component for creating a server over HyperDHT
const libKeys = require('hyper-cmd-lib-keys') // generate a random seed
const b4a = require('b4a') // generate random connector

const { createHash } = require('node:crypto') // This will convert the connector to a seed of 64 length

const boxConsole = require('cli-box') // Print pretty
const colors = require('colors/safe')
const qrcode = require('qrcode-terminal')

class Server {
  // Set appropriate values from options
  // NOTE: Port is taken directly from the options, this.options.port
  constructor (options) {
    this.options = options
    this.host = options.host || '127.0.0.1'
    this.public = options.public
    this.localServer = new DHT()
    this.isConnectorSet = true // To enable different logic for connector/keys
    this.connector = this.setupConnector(options.connector)
    this.udp = this.options.udp
    this.service = options.service
    this.customText = options.customText || ''
  }

  // Logic for handling default (connector) mode and public mode
  setupConnector (connector) {
    // Use keys if public mode is enabled
    if (this.public) {
      this.isConnectorSet = false
      return null // Setting the connector null locally will result in a key generation by holesail-client
    }

    // generate seed from, if a custom connector is supplied.
    if (connector && typeof (connector) !== 'boolean') {
      this.isConnectorSet = true
      return createHash('sha256').update(connector.toString()).digest('hex') // Create seed from connector
    } else {
      const buffer = Buffer.from(libKeys.randomBytes(32).toString('hex'), 'hex')// Generate a random buffer
      const connectorSeed = b4a.toString(buffer, 'hex').substring(0, 60) // Generate connector from buffer and trim to 60 chars
      this.options.connector = connectorSeed // Hi-jack connector parameter so the code for QR code and printbox passes.

      this.isConnectorSet = true
      return createHash('sha256').update(connectorSeed.toString()).digest('hex') // Create seed from connector
    }
  }

  // Call holesail-server on demand with options
  async start () {
    console.log(this.isConnectorSet)
    await this.localServer.start({
      port: this.options.port,
      host: this.host,
      seed: this.connector,
      secure: this.isConnectorSet,
      udp: this.udp
    }, () => {
      this.printBox()
    })
  }

  printBox () {
    // Pretty output in the terminal
    if (this.isConnectorSet) {
      let protocol
      if (this.udp) {
        protocol = 'UDP [BETA]'
      } else {
        protocol = 'TCP'
      }
      const box = boxConsole('100x10', {
        text: colors.cyan.underline.bold(`Holesail ${protocol} ${this.service} Started`) + ' ⛵️' + '\n' +
                        colors.magenta('Connection Mode: ') + colors.cyan('Private Connection String') + '\n' +
                        colors.magenta('Holesail is now listening on ') + `${this.host}:` + this.options.port + '\n' +
                        colors.green(this.customText) +
                        'Connection string: ' + colors.white(`${this.options.connector}`) + '\n' +
                        colors.gray('   NOTE: TREAT PRIVATE CONNECTION STRINGS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    '),
        autoEOL: true,
        vAlign: 'middle',
        hAlign: 'middle',
        stretch: true
      }
      )

      console.log(box)
      console.log('OR Scan the QR to connect: ')
      qrcode.generate(this.localServer.key, { small: true }, function (qrcode) {
        console.log(qrcode)
      })
    } else {
      const box = boxConsole('100x10', {
        text: colors.cyan.underline.bold(`Holesail ${this.service} Started`) + ' ⛵️' + '\n' +
                        colors.magenta('Connection Mode: ') + colors.yellow('Public Connection String \n') +
                        colors.magenta('Holesail is now listening on ') + `${this.host}:` + this.options.port + '\n' +
                        colors.green(this.customText) +
                        'Connection string: ' + colors.white(`${this.options.connector}`) + '\n' +
                        colors.gray('   NOTICE: TREAT PUBLIC STRING LIKE YOU WOULD TREAT A DOMAIN NAME ON PUBLIC SERVER, IF THERE IS ANYTHING PRIVATE ON IT, IT IS YOUR RESPONSIBILITY TO PASSWORD PROTECT IT OR USE PRIVATE MODE   \n'),
        autoEOL: true,
        vAlign: 'middle',
        hAlign: 'middle',
        stretch: true
      }
      )
      console.log(box)
      console.log('OR Scan the QR to connect: ')
      qrcode.generate(this.localServer.key, { small: true }, function (qrcode) {
        console.log(qrcode)
      })
    }
  }

  // Destroy DHT connection
  async destroy () {
    await this.localServer.destroy()
  }
}

module.exports = Server
