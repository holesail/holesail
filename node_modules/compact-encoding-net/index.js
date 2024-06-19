const c = require('compact-encoding')

const port = c.uint16

const address = (host, family) => {
  return {
    preencode (state, m) {
      host.preencode(state, m.host)
      port.preencode(state, m.port)
    },
    encode (state, m) {
      host.encode(state, m.host)
      port.encode(state, m.port)
    },
    decode (state) {
      return {
        host: host.decode(state),
        family,
        port: port.decode(state)
      }
    }
  }
}

const ipv4 = {
  preencode (state) {
    state.end += 4
  },
  encode (state, string) {
    const start = state.start
    const end = start + 4

    let i = 0

    while (i < string.length) {
      let n = 0
      let c

      while (i < string.length && (c = string.charCodeAt(i++)) !== /* . */ 0x2e) {
        n = n * 10 + (c - /* 0 */ 0x30)
      }

      state.buffer[state.start++] = n
    }

    state.start = end
  },
  decode (state) {
    if (state.end - state.start < 4) throw new Error('Out of bounds')
    return (
      state.buffer[state.start++] + '.' +
      state.buffer[state.start++] + '.' +
      state.buffer[state.start++] + '.' +
      state.buffer[state.start++]
    )
  }
}

const ipv4Address = address(ipv4, 4)

const ipv6 = {
  preencode (state) {
    state.end += 16
  },
  encode (state, string) {
    const start = state.start
    const end = start + 16

    let i = 0
    let split = null

    while (i < string.length) {
      let n = 0
      let c

      while (i < string.length && (c = string.charCodeAt(i++)) !== /* : */ 0x3a) {
        if (c >= 0x30 && c <= 0x39) n = n * 0x10 + (c - /* 0 */ 0x30)
        else if (c >= 0x41 && c <= 0x46) n = n * 0x10 + (c - /* A */ 0x41 + 10)
        else if (c >= 0x61 && c <= 0x66) n = n * 0x10 + (c - /* a */ 0x61 + 10)
      }

      state.buffer[state.start++] = n >>> 8
      state.buffer[state.start++] = n

      if (i < string.length && string.charCodeAt(i) === /* : */ 0x3a) {
        i++
        split = state.start
      }
    }

    if (split !== null) {
      const offset = end - state.start
      state.buffer
        .copyWithin(split + offset, split)
        .fill(0, split, split + offset)
    }

    state.start = end
  },
  decode (state) {
    if (state.end - state.start < 16) throw new Error('Out of bounds')
    return (
      (state.buffer[state.start++] * 256 + state.buffer[state.start++]).toString(16) + ':' +
      (state.buffer[state.start++] * 256 + state.buffer[state.start++]).toString(16) + ':' +
      (state.buffer[state.start++] * 256 + state.buffer[state.start++]).toString(16) + ':' +
      (state.buffer[state.start++] * 256 + state.buffer[state.start++]).toString(16) + ':' +
      (state.buffer[state.start++] * 256 + state.buffer[state.start++]).toString(16) + ':' +
      (state.buffer[state.start++] * 256 + state.buffer[state.start++]).toString(16) + ':' +
      (state.buffer[state.start++] * 256 + state.buffer[state.start++]).toString(16) + ':' +
      (state.buffer[state.start++] * 256 + state.buffer[state.start++]).toString(16)
    )
  }
}

const ipv6Address = address(ipv6, 6)

const ip = {
  preencode (state, string) {
    const family = string.includes(':') ? 6 : 4
    c.uint8.preencode(state, family)
    if (family === 4) ipv4.preencode(state)
    else ipv6.preencode(state)
  },
  encode (state, string) {
    const family = string.includes(':') ? 6 : 4
    c.uint8.encode(state, family)
    if (family === 4) ipv4.encode(state, string)
    else ipv6.encode(state, string)
  },
  decode (state) {
    const family = c.uint8.decode(state)
    if (family === 4) return ipv4.decode(state)
    else return ipv6.decode(state)
  }
}

const ipAddress = {
  preencode (state, m) {
    ip.preencode(state, m.host)
    port.preencode(state, m.port)
  },
  encode (state, m) {
    ip.encode(state, m.host)
    port.encode(state, m.port)
  },
  decode (state) {
    const family = c.uint8.decode(state)
    return {
      host: family === 4 ? ipv4.decode(state) : ipv6.decode(state),
      family,
      port: port.decode(state)
    }
  }
}

module.exports = {
  port,
  ipv4,
  ipv4Address,
  ipv6,
  ipv6Address,
  ip,
  ipAddress
}
