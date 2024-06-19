const path = require('path')
const fs = require('fs')

const root = path.join(__dirname, '..')

const libsodium = path.join(root, 'vendor/libsodium/src/libsodium')

const version = '1.0.18'

const file = fs.readFileSync(path.join(libsodium, 'include/sodium/version.h.in'), 'utf-8')
  .replace('@VERSION@', version)
  .replace('@SODIUM_LIBRARY_VERSION_MAJOR@', 10)
  .replace('@SODIUM_LIBRARY_VERSION_MINOR@', 3)
  .replace('@SODIUM_LIBRARY_MINIMAL_DEF@', '')

fs.writeFileSync(path.join(libsodium, 'include/sodium/version.h'), file)

process.stdout.write(version)
