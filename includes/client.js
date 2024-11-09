const holesailClient = require('holesail-client')

const b4a = require('b4a')
const { createHash } = require('node:crypto')

const boxConsole = require('cli-box')
const colors = require('colors/safe')

class Client {
  constructor (keyInput, options) {
    this.keyInput = keyInput
    this.options = options
    this.isConnectorSet = false
    this.connector = this.setupConnector(keyInput)
    this.host = options.host || '127.0.0.1'
    this.port = options.port || 8989
    this.pubClient = this.initializeClient()
    this.udp = options.udp
  }

  setupConnector (keyInput) {
    if (keyInput.length === 64) {
      this.isConnectorSet = false
      return keyInput
    } else {
      const connector = createHash('sha256').update(keyInput.toString()).digest('hex')
      this.isConnectorSet = true
      const seed = Buffer.from(connector, 'hex')
      return b4a.toString(seed, 'hex')
    }
  }

  initializeClient () {
    if (this.isConnectorSet) {
      return new holesailClient(this.connector, 'secure')
    } else {
      return new holesailClient(this.connector)
    }
  }

  start () {
    this.pubClient.connect({ port: this.port, address: this.host, udp: this.udp }, () => {
      if (this.isConnectorSet) {
        this.printBox('Super Secret Connector', 'Connected to Secret Connector: ' + colors.white(this.keyInput))
      } else {
        this.printBox('Publicly Sharable Key', '')
      }
    })
  }

  printBox () {
    if (this.isConnectorSet) {
      let protocol
      if (this.udp) {
        protocol = 'UDP'
      } else {
        protocol = 'TCP'
      }

      var box = boxConsole('100x10', {
        text: colors.cyan.underline.bold(`Holesail ${protocol} Client Started`) + ' ⛵️' + '\n' +
                        colors.magenta('Connection Mode: ') + colors.green('Private Connection String') + '\n' +
                        colors.magenta(`Access application on http://${this.host}:${this.port}/`) + '\n' +
                        colors.gray(`Connection string: ${this.keyInput}`) + '\n' +
                        colors.gray('   NOTE: TREAT PRIVATE CONNECTION STRINGS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    '),
        autoEOL: true,
        vAlign: 'middle',
        hAlign: 'middle',
        stretch: true
      }
      )
      console.log(box)
    } else {
      let protocol
      if (this.udp) {
        protocol = 'UDP'
      } else {
        protocol = 'TCP'
      }
      var box = boxConsole('100x10', {
        text: colors.cyan.underline.bold(`Holesail ${protocol} Client Started`) + ' ⛵️' + '\n' +
                        colors.magenta('Connection Mode: ') + colors.yellow('Public Connection String') + '\n' +
                        colors.magenta(`Access application on http://${this.host}:${this.port}/`) + '\n' +
                        colors.gray(`Connection String: ${this.connector}`) + '\n' +
                        colors.gray('   NOTICE: TREAT PUBLIC STRING LIKE YOU WOULD TREAT A DOMAIN NAME ON PUBLIC SERVER, IF THERE IS ANYTHING PRIVATE ON IT, IT IS YOUR RESPONSIBILITY TO PASSWORD PROTECT IT OR USE PRIVATE MODE   '),
        autoEOL: true,
        vAlign: 'middle',
        hAlign: 'middle',
        stretch: true
      }
      )
      console.log(box)
    }
  }
}

module.exports = Client
