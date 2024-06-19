const bench = require('nanobench')
const c = require('compact-encoding')
const { ipv4 } = require('../')

const ip = '1.2.3.4'

bench('ipv4 encode', function (b) {
  b.start()

  let result

  for (let i = 0; i < 10000000; i++) {
    result = c.encode(ipv4, ip)
  }

  b.log(result.toString('hex'))
  b.end()
})

bench('ipv4 encode', function (b) {
  const buffer = c.encode(ipv4, ip)

  b.start()

  let result

  for (let i = 0; i < 10000000; i++) {
    result = c.decode(ipv4, buffer)
  }

  b.log(JSON.stringify(result))
  b.end()
})
