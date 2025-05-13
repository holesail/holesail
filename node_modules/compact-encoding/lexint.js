module.exports = {
  preencode,
  encode,
  decode
}

function preencode (state, num) {
  if (num < 251) {
    state.end++
  } else if (num < 256) {
    state.end += 2
  } else if (num < 0x10000) {
    state.end += 3
  } else if (num < 0x1000000) {
    state.end += 4
  } else if (num < 0x100000000) {
    state.end += 5
  } else {
    state.end++
    const exp = Math.floor(Math.log(num) / Math.log(2)) - 32
    preencode(state, exp)
    state.end += 6
  }
}

function encode (state, num) {
  const max = 251
  const x = num - max

  if (num < max) {
    state.buffer[state.start++] = num
  } else if (num < 256) {
    state.buffer[state.start++] = max
    state.buffer[state.start++] = x
  } else if (num < 0x10000) {
    state.buffer[state.start++] = max + 1
    state.buffer[state.start++] = x >> 8 & 0xff
    state.buffer[state.start++] = x & 0xff
  } else if (num < 0x1000000) {
    state.buffer[state.start++] = max + 2
    state.buffer[state.start++] = x >> 16
    state.buffer[state.start++] = x >> 8 & 0xff
    state.buffer[state.start++] = x & 0xff
  } else if (num < 0x100000000) {
    state.buffer[state.start++] = max + 3
    state.buffer[state.start++] = x >> 24
    state.buffer[state.start++] = x >> 16 & 0xff
    state.buffer[state.start++] = x >> 8 & 0xff
    state.buffer[state.start++] = x & 0xff
  } else {
    // need to use Math here as bitwise ops are 32 bit
    const exp = Math.floor(Math.log(x) / Math.log(2)) - 32
    state.buffer[state.start++] = 0xff

    encode(state, exp)
    const rem = x / Math.pow(2, exp - 11)

    for (let i = 5; i >= 0; i--) {
      state.buffer[state.start++] = rem / Math.pow(2, 8 * i) & 0xff
    }
  }
}

function decode (state) {
  const max = 251

  if (state.end - state.start < 1) throw new Error('Out of bounds')

  const flag = state.buffer[state.start++]

  if (flag < max) return flag

  if (state.end - state.start < flag - max + 1) {
    throw new Error('Out of bounds.')
  }

  if (flag < 252) {
    return state.buffer[state.start++] +
      max
  }

  if (flag < 253) {
    return (state.buffer[state.start++] << 8) +
      state.buffer[state.start++] +
      max
  }

  if (flag < 254) {
    return (state.buffer[state.start++] << 16) +
      (state.buffer[state.start++] << 8) +
      state.buffer[state.start++] +
      max
  }

  // << 24 result may be interpreted as negative
  if (flag < 255) {
    return (state.buffer[state.start++] * 0x1000000) +
      (state.buffer[state.start++] << 16) +
      (state.buffer[state.start++] << 8) +
      state.buffer[state.start++] +
      max
  }

  const exp = decode(state)

  if (state.end - state.start < 6) throw new Error('Out of bounds')

  let rem = 0
  for (let i = 5; i >= 0; i--) {
    rem += state.buffer[state.start++] * Math.pow(2, 8 * i)
  }

  return (rem * Math.pow(2, exp - 11)) + max
}
