const bench = require('nanobench')
const { randomBytes } = require('node:crypto')

const buffers = Array(1e4)
  .fill(null)
  .map(() => {
    return randomBytes(Math.round(Math.random() * 100))
  })

bench('z32 encode 100 times', function (b) {
  const z32 = require('.')
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const buf of buffers) {
      z32.encode(buf)
    }
  }

  b.end()
})

bench('z32 decode 100 times', function (b) {
  const z32 = require('.')
  const encoded = buffers.map(buf => z32.encode(buf))
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const s of encoded) {
      z32.decode(s)
    }
  }

  b.end()
})

bench("buf.toString('hex') 100 times", function (b) {
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const buf of buffers) {
      buf.toString('hex')
    }
  }

  b.end()
})

bench("Buffer.from(s, 'hex') 100 times", function (b) {
  const encoded = buffers.map(buf => buf.toString('hex'))
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const s of encoded) {
      Buffer.from(s, 'hex')
    }
  }

  b.end()
})

bench('base32 encode 100 times', function (b) {
  const base32 = require('base32')
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const buf of buffers) {
      base32.encode(buf)
    }
  }

  b.end()
})

bench('base32 decode 100 times', function (b) {
  const base32 = require('base32')
  const encoded = buffers.map(buf => base32.encode(buf))
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const s of encoded) {
      base32.decode(s)
    }
  }

  b.end()
})

bench('rfc4648.base32 encode 100 times', function (b) {
  const { base32 } = require('rfc4648')
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const buf of buffers) {
      base32.stringify(buf)
    }
  }

  b.end()
})

bench('rfc4648.base32 decode 100 times', function (b) {
  const { base32 } = require('rfc4648')
  const encoded = buffers.map(buf => base32.stringify(buf))
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const s of encoded) {
      base32.parse(s, { out: Buffer.allocUnsafe })
    }
  }

  b.end()
})

bench('base-x z-base-32 encode 100 times', function (b) {
  const ZBASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769'
  const base32 = require('base-x')(ZBASE32)
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const buf of buffers) {
      base32.encode(buf)
    }
  }

  b.end()
})

bench('base-x z-base-32 decode 100 times', function (b) {
  const ZBASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769'
  const base32 = require('base-x')(ZBASE32)
  const encoded = buffers.map(buf => base32.encode(buf))
  b.start()
  for (let i = 0; i < 100; i++) {
    for (const s of encoded) {
      base32.decode(s)
    }
  }

  b.end()
})
