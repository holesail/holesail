const bench = require('nanobench')
const c = require('compact-encoding')
const { ipv6 } = require('../')

const ip = '1:2:3:4:5:6:7:8'

bench('ipv6 encode', function (b) {
  b.start()

  let result

  for (let i = 0; i < 10000000; i++) {
    result = c.encode(ipv6, ip)
  }

  b.log(result.toString('hex'))
  b.end()
})

bench('ipv6 encode', function (b) {
  const buffer = c.encode(ipv6, ip)

  b.start()

  let result

  for (let i = 0; i < 10000000; i++) {
    result = c.decode(ipv6, buffer)
  }

  b.log(JSON.stringify(result))
  b.end()
})
