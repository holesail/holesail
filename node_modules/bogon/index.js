// https://ipinfo.io/bogon

const b4a = require('b4a')
const c = require('compact-encoding')
const net = require('compact-encoding-net')

module.exports = exports = function isBogon (ip) {
  return isBogonIP(ensureBuffer(ip))
}

exports.isBogon = exports

exports.isPrivate = function isPrivate (ip) {
  return isPrivateIP(ensureBuffer(ip))
}

function isBogonIP (ip) {
  return isPrivateIP(ip) || isReservedIP(ip)
}

function isPrivateIP (ip) {
  return ip.byteLength === 4 ? isPrivateIPv4(ip) : false // IPv6 has no private IPs
}

function isPrivateIPv4 (ip) {
  return (
    // 10.0.0.0/8  Private-use networks
    (ip[0] === 10) ||
    // 100.64.0.0/10 Carrier-grade NAT
    (ip[0] === 100 && ip[1] >= 64 && ip[1] <= 127) ||
    // 127.0.0.0/8 Loopback + Name collision occurrence (127.0.53.53)
    (ip[0] === 127) ||
    // 169.254.0.0/16  Link local
    (ip[0] === 169 && ip[1] === 254) ||
    // 172.16.0.0/12 Private-use networks
    (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) ||
    // 192.168.0.0/16  Private-use networks
    (ip[0] === 192 && ip[1] === 168)
  )
}

function isReservedIP (ip) {
  return ip.byteLength === 4 ? isReservedIPv4(ip) : isReservedIPv6(ip)
}

function isReservedIPv4 (ip) {
  return (
    // 0.0.0.0/8 "This" network
    (ip[0] === 0) ||
    // 192.0.0.0/24  IETF protocol assignments
    (ip[0] === 192 && ip[1] === 0 && ip[2] === 0) ||
    // 192.0.2.0/24  TEST-NET-1
    (ip[0] === 192 && ip[1] === 0 && ip[2] === 2) ||
    // 198.18.0.0/15 Network interconnect device benchmark testing
    (ip[0] === 198 && ip[1] >= 18 && ip[1] <= 19) ||
    // 198.51.100.0/24 TEST-NET-2
    (ip[0] === 198 && ip[1] === 51 && ip[2] === 100) ||
    // 203.0.113.0/24  TEST-NET-3
    (ip[0] === 203 && ip[1] === 0 && ip[2] === 113) ||
    // 224.0.0.0/4 Multicast
    (ip[0] >= 224 && ip[0] <= 239) ||
    // 240.0.0.0/4 Reserved for future use
    (ip[0] >= 240) ||
    // 255.255.255.255/32
    (ip[0] === 255 && ip[1] === 255 && ip[2] === 255 && ip[3] === 255)
  )
}

function isReservedIPv6 (ip) {
  return (
    // ::/128 Node-scope unicast unspecified address
    // ::1/128 Node-scope unicast loopback address
    (
      ip[0] === 0 && ip[1] === 0 && ip[2] === 0 && ip[3] === 0 && ip[4] === 0 &&
      ip[5] === 0 && ip[6] === 0 && ip[7] === 0 && ip[8] === 0 && ip[9] === 0 &&
      ip[10] === 0 && ip[11] === 0 && ip[12] === 0 && ip[13] === 0 && ip[14] === 0 &&
      ip[15] <= 1
    ) ||
    // ::ffff:0:0/96 IPv4-mapped addresses
    // ::/96 IPv4-compatible addresses
    (
      ip[0] === 0 && ip[1] === 0 && ip[2] === 0 && ip[3] === 0 && ip[4] === 0 &&
      ip[5] === 0 && ip[6] === 0 && ip[7] === 0 && ip[8] === 0 && ip[9] === 0 &&
      (ip[10] === 0 || ip[10] === 0xff) &&
      (ip[11] === 0 || ip[11] === 0xff)
    ) ||
    // 100::/64 Remotely triggered black hole addresses
    (ip[0] === 0x01 && ip[1] === 0 && ip[2] === 0 && ip[3] === 0 && ip[4] === 0 && ip[5] === 0 && ip[6] === 0 && ip[7] === 0) ||
    // 2001:10::/28 Overlay routable cryptographic hash identifiers (ORCHID)
    (ip[0] === 0x20 && ip[1] === 0x01 && ip[2] === 0 && ip[3] >= 0x10 && ip[3] <= 0x1f) ||
    // 2001:20::/28 Overlay routable cryptographic hash identifiers version 2 (ORCHIDv2)
    (ip[0] === 0x20 && ip[1] === 0x01 && ip[2] === 0 && ip[3] >= 0x20 && ip[3] <= 0x2f) ||
    // 2001:db8::/32 Documentation prefix
    (ip[0] === 0x20 && ip[1] === 0x01 && ip[2] === 0x0d && ip[3] === 0xb8) ||
    // fc00::/7 Unique local addresses (ULA)
    (ip[0] >= 0xfc && ip[0] <= 0xfd) ||
    // fe80::/10 Link-local unicast
    (ip[0] === 0xfe && ip[1] >= 0x80 && ip[1] <= 0xbf) ||
    // ff00::/8 Multicast
    (ip[0] === 0xff)
  )
}

const state = c.state(0, 0, b4a.allocUnsafe(1 /* family */ + 16))

function ensureBuffer (ip) {
  if (b4a.isBuffer(ip)) return ip

  net.ip.preencode(state, ip)
  net.ip.encode(state, ip)

  const buffer = state.buffer.subarray(1 /* family */, state.end)

  state.start = 0
  state.end = 0

  return buffer
}
