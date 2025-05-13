const sodium = require('sodium-universal')
const c = require('compact-encoding')
const net = require('compact-encoding-net')
const b4a = require('b4a')

const ipv4 = {
  ...net.ipv4Address,
  decode (state) {
    const ip = net.ipv4Address.decode(state)
    return {
      id: null, // populated by the callee
      host: ip.host,
      port: ip.port
    }
  }
}

module.exports = { id, ipv4, ipv4Array: c.array(ipv4) }

function id (host, port, out = b4a.allocUnsafeSlow(32)) {
  const addr = out.subarray(0, 6)
  ipv4.encode(
    { start: 0, end: 6, buffer: addr },
    { host, port }
  )
  sodium.crypto_generichash(out, addr)
  return out
}
