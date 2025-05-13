import test from 'brittle'
import b4a from 'b4a'

import { isBogon } from './index.js'

test('ipv4', (t) => {
  t.ok(isBogon('127.0.0.1'), 'loopback, string')
  t.ok(isBogon(b4a.from([127, 0, 0, 1])), 'loopback, buffer')

  t.absent(isBogon('84.123.96.194'), 'not bogon, string')
  t.absent(isBogon(b4a.from([84, 123, 96, 194])), 'not bogon, buffer')
})

test('ipv6', (t) => {
  t.ok(isBogon('::1'), 'loopback, string')
  t.ok(isBogon(b4a.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])), 'loopback, buffer')

  t.absent(isBogon('89c7:2c35:937e:3171:10c:831a:a32e:bff4'), 'not bogon, string')
  t.absent(isBogon(b4a.from([0x89, 0xc7, 0x2c, 0x35, 0x93, 0x7e, 0x31, 0x71, 0x10, 0xc, 0x83, 0x1a, 0xa3, 0x2e, 0xbf, 0xf4])), 'not bogon, buffer')

  t.ok(isBogon('::ffff:127.0.0.1'), 'ipv4-mapped')
  t.ok(isBogon('fe80::c001:1dff:fee0:0'), 'link-local')
})
