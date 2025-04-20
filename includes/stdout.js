const colors = require('barely-colours')
const boxConsole = require('cli-box')

function stdout (protocol, type, secure, host, port, key, livefiles) {

  if (livefiles) {

  }

const _HEADING = colors.cyan(colors.underline(colors.bold(`Holesail ${ livefiles ? 'Filemanager' : `${protocol.toUpperCase()} ${type[0].toUpperCase() + type.slice(1)}` } Started`)))


  const _MODE = secure ? colors.green('Private Connection String') : colors.yellow('Public Connection String')

  const _URL = type === 'server' ? colors.magenta(`Holesail is now listening on `) + `${host}:${port}` : colors.magenta(`Access application on http://${host}:${port}/`)

  const _KEY = type === 'server' ? `Connect with key: ${colors.dim(key)}` : `Connected to key: ${colors.dim(key)}`

  const _INFO = secure ? colors.dim(`   NOTE: TREAT PRIVATE CONNECTION STRINGS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    `) :colors.dim(`   NOTICE: TREAT PUBLIC STRING LIKE YOU WOULD TREAT A DOMAIN NAME ON PUBLIC SERVER, IF THERE IS ANYTHING PRIVATE ON IT, IT IS YOUR RESPONSIBILITY TO PASSWORD PROTECT IT OR USE PRIVATE MODE   \n`)

  const box = boxConsole('100x10', {
      text: _HEADING + ' ⛵️' + '\n' +
        colors.magenta('Connection Mode: ') + _MODE + '\n' +
        _URL + '\n' +
        _KEY + '\n' +
        _INFO,
      autoEOL: true,
      vAlign: 'middle',
      hAlign: 'middle',
      stretch: true
    }
  )

  console.log(box)

}

stdout('udp', 'client', true, '127.0.0.1', 3434, 'f05d903fb2e99f9c2ad38f296126dcf14e95eab7b4d4918aba1f771bca97e551')

