const os = require('os')

process.stdout.write(os.endianness().toLowerCase())
