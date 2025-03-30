const HolesailClient = require('holesail-client')

const b4a = require('b4a')
const { createHash } = require('crypto')

const boxConsole = require('cli-box')
const colors = require('colors/safe')
const z32 =  require('z32')

class Client {
  constructor (keyInput, options) {
    this.keyInput = keyInput
    this.options = options
    this.isConnectorSet = false
    this.connector = this.setupConnector(keyInput)
    this.host = options.host
    this.port = options.port
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
      console.log(connector)
      const seed = Buffer.from(connector, 'hex')
      return z32.encode(seed)
    }
  }

  initializeClient () {
    if (this.isConnectorSet) {
      return new HolesailClient({ key: this.connector, secure: true })
    } else {
      return new HolesailClient({ key: this.connector })
    }
  }

  start () {
    this.pubClient.connect({ port: this.port, host: this.host, udp: this.udp }, () => {
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
        protocol = 'UDP [BETA]'
      } else {
        protocol = 'TCP'
      }

      const box = boxConsole('100x10', {
        text: colors.cyan.underline.bold(`Holesail ${protocol} Client Started`) + ' ⛵️' + '\n' +
                        colors.magenta('Connection Mode: ') + colors.green('Private Connection String') + '\n' +
                        colors.magenta(`Access application on http://${this.pubClient.info.host}:${this.pubClient.info.port}/`) + '\n' +
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
      const box = boxConsole('100x10', {
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
