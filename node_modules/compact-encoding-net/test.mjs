import test from 'brittle'
import c from 'compact-encoding'

import { port, ipv4, ipv6, ipv4Address, ipv6Address, ip, ipAddress } from './index.js'

test('port', (t) => {
  const p = 0x1234
  const buf = Buffer.from([0x34, 0x12])

  t.alike(c.encode(port, p), buf)
  t.alike(c.decode(port, buf), p)
})

test('ipv4', (t) => {
  const ip = '1.2.3.4'
  const buf = Buffer.from([1, 2, 3, 4])

  t.alike(c.encode(ipv4, ip), buf)
  t.alike(c.decode(ipv4, buf), ip)
})

test('ipv4 + port', (t) => {
  const host = '1.2.3.4'
  const port = 1234

  t.alike(c.decode(ipv4Address, c.encode(ipv4Address, { host, port })), {
    host,
    family: 4,
    port
  })
})

test('ipv6', (t) => {
  const ip = '1:2:3:4:5:6:7:8'
  const buf = Buffer.from([0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8])

  t.alike(c.encode(ipv6, ip), buf)
  t.alike(c.decode(ipv6, buf), ip)

  t.test('abbreviated', (t) => {
    const buf = Buffer.from([0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 8])

    t.alike(c.encode(ipv6, '1:2::7:8'), buf)
    t.alike(c.decode(ipv6, buf), '1:2:0:0:0:0:7:8')
  })

  t.test('prefix abbreviated', (t) => {
    const buf = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 6, 0, 7, 0, 8])

    t.alike(c.encode(ipv6, '::5:6:7:8'), buf)
    t.alike(c.decode(ipv6, buf), '0:0:0:0:5:6:7:8')
  })

  t.test('suffix abbreviated', (t) => {
    const buf = Buffer.from([0, 1, 0, 2, 0, 3, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0])

    t.alike(c.encode(ipv6, '1:2:3:4::'), buf)
    t.alike(c.decode(ipv6, buf), '1:2:3:4:0:0:0:0')
  })

  t.test('any', (t) => {
    const buf = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

    t.alike(c.encode(ipv6, '::'), buf)
    t.alike(c.decode(ipv6, buf), '0:0:0:0:0:0:0:0')
  })

  t.test('lowercase hex', (t) => {
    const buf = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xab, 0xcd])

    t.alike(c.encode(ipv6, '::abcd'), buf)
    t.alike(c.decode(ipv6, buf), '0:0:0:0:0:0:0:abcd')
  })

  t.test('uppercase hex', (t) => {
    const buf = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xab, 0xcd])

    t.alike(c.encode(ipv6, '::ABCD'), buf)
    t.alike(c.decode(ipv6, buf), '0:0:0:0:0:0:0:abcd')
  })
})

test('ipv6 + port', (t) => {
  const host = '1:2:3:4:5:6:7:8'
  const port = 1234

  t.alike(c.decode(ipv6Address, c.encode(ipv6Address, { host, port })), {
    host,
    family: 6,
    port
  })
})

test('dual ip', (t) => {
  {
    const host = '1.2.3.4'

    t.alike(c.decode(ip, c.encode(ip, host)), host, 'ipv4')
  }
  {
    const host = '1:2:3:4:5:6:7:8'

    t.alike(c.decode(ip, c.encode(ip, host)), host, 'ipv6')
  }
})

test('dual ip + port', (t) => {
  const port = 1234

  {
    const host = '1.2.3.4'

    t.alike(c.decode(ipAddress, c.encode(ipAddress, { host, port })), {
      host,
      family: 4,
      port
    }, 'ipv4')
  }
  {
    const host = '1:2:3:4:5:6:7:8'

    t.alike(c.decode(ipAddress, c.encode(ipAddress, { host, port })), {
      host,
      family: 6,
      port
    }, 'ipv6')
  }
})
