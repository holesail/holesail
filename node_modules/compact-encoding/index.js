const b4a = require('b4a')

const { BE } = require('./endian')

exports.state = function (start = 0, end = 0, buffer = null) {
  return { start, end, buffer, cache: null }
}

const raw = exports.raw = require('./raw')

const uint = exports.uint = {
  preencode (state, n) {
    state.end += n <= 0xfc ? 1 : n <= 0xffff ? 3 : n <= 0xffffffff ? 5 : 9
  },
  encode (state, n) {
    if (n <= 0xfc) uint8.encode(state, n)
    else if (n <= 0xffff) {
      state.buffer[state.start++] = 0xfd
      uint16.encode(state, n)
    } else if (n <= 0xffffffff) {
      state.buffer[state.start++] = 0xfe
      uint32.encode(state, n)
    } else {
      state.buffer[state.start++] = 0xff
      uint64.encode(state, n)
    }
  },
  decode (state) {
    const a = uint8.decode(state)
    if (a <= 0xfc) return a
    if (a === 0xfd) return uint16.decode(state)
    if (a === 0xfe) return uint32.decode(state)
    return uint64.decode(state)
  }
}

const uint8 = exports.uint8 = {
  preencode (state, n) {
    state.end += 1
  },
  encode (state, n) {
    validateUint(n)
    state.buffer[state.start++] = n
  },
  decode (state) {
    if (state.start >= state.end) throw new Error('Out of bounds')
    return state.buffer[state.start++]
  }
}

const uint16 = exports.uint16 = {
  preencode (state, n) {
    state.end += 2
  },
  encode (state, n) {
    validateUint(n)
    state.buffer[state.start++] = n
    state.buffer[state.start++] = n >>> 8
  },
  decode (state) {
    if (state.end - state.start < 2) throw new Error('Out of bounds')
    return (
      state.buffer[state.start++] +
      state.buffer[state.start++] * 0x100
    )
  }
}

const uint24 = exports.uint24 = {
  preencode (state, n) {
    state.end += 3
  },
  encode (state, n) {
    validateUint(n)
    state.buffer[state.start++] = n
    state.buffer[state.start++] = n >>> 8
    state.buffer[state.start++] = n >>> 16
  },
  decode (state) {
    if (state.end - state.start < 3) throw new Error('Out of bounds')
    return (
      state.buffer[state.start++] +
      state.buffer[state.start++] * 0x100 +
      state.buffer[state.start++] * 0x10000
    )
  }
}

const uint32 = exports.uint32 = {
  preencode (state, n) {
    state.end += 4
  },
  encode (state, n) {
    validateUint(n)
    state.buffer[state.start++] = n
    state.buffer[state.start++] = n >>> 8
    state.buffer[state.start++] = n >>> 16
    state.buffer[state.start++] = n >>> 24
  },
  decode (state) {
    if (state.end - state.start < 4) throw new Error('Out of bounds')
    return (
      state.buffer[state.start++] +
      state.buffer[state.start++] * 0x100 +
      state.buffer[state.start++] * 0x10000 +
      state.buffer[state.start++] * 0x1000000
    )
  }
}

const uint40 = exports.uint40 = {
  preencode (state, n) {
    state.end += 5
  },
  encode (state, n) {
    validateUint(n)
    const r = Math.floor(n / 0x100)
    uint8.encode(state, n)
    uint32.encode(state, r)
  },
  decode (state) {
    if (state.end - state.start < 5) throw new Error('Out of bounds')
    return uint8.decode(state) + 0x100 * uint32.decode(state)
  }
}

const uint48 = exports.uint48 = {
  preencode (state, n) {
    state.end += 6
  },
  encode (state, n) {
    validateUint(n)
    const r = Math.floor(n / 0x10000)
    uint16.encode(state, n)
    uint32.encode(state, r)
  },
  decode (state) {
    if (state.end - state.start < 6) throw new Error('Out of bounds')
    return uint16.decode(state) + 0x10000 * uint32.decode(state)
  }
}

const uint56 = exports.uint56 = {
  preencode (state, n) {
    state.end += 7
  },
  encode (state, n) {
    validateUint(n)
    const r = Math.floor(n / 0x1000000)
    uint24.encode(state, n)
    uint32.encode(state, r)
  },
  decode (state) {
    if (state.end - state.start < 7) throw new Error('Out of bounds')
    return uint24.decode(state) + 0x1000000 * uint32.decode(state)
  }
}

const uint64 = exports.uint64 = {
  preencode (state, n) {
    state.end += 8
  },
  encode (state, n) {
    validateUint(n)
    const r = Math.floor(n / 0x100000000)
    uint32.encode(state, n)
    uint32.encode(state, r)
  },
  decode (state) {
    if (state.end - state.start < 8) throw new Error('Out of bounds')
    return uint32.decode(state) + 0x100000000 * uint32.decode(state)
  }
}

const int = exports.int = zigZagInt(uint)
exports.int8 = zigZagInt(uint8)
exports.int16 = zigZagInt(uint16)
exports.int24 = zigZagInt(uint24)
exports.int32 = zigZagInt(uint32)
exports.int40 = zigZagInt(uint40)
exports.int48 = zigZagInt(uint48)
exports.int56 = zigZagInt(uint56)
exports.int64 = zigZagInt(uint64)

const biguint64 = exports.biguint64 = {
  preencode (state, n) {
    state.end += 8
  },
  encode (state, n) {
    const view = new DataView(state.buffer.buffer, state.start + state.buffer.byteOffset, 8)
    view.setBigUint64(0, n, true) // little endian
    state.start += 8
  },
  decode (state) {
    if (state.end - state.start < 8) throw new Error('Out of bounds')
    const view = new DataView(state.buffer.buffer, state.start + state.buffer.byteOffset, 8)
    const n = view.getBigUint64(0, true) // little endian
    state.start += 8
    return n
  }
}

exports.bigint64 = zigZagBigInt(biguint64)

const biguint = exports.biguint = {
  preencode (state, n) {
    let len = 0
    for (let m = n; m; m = m >> 64n) len++
    uint.preencode(state, len)
    state.end += 8 * len
  },
  encode (state, n) {
    let len = 0
    for (let m = n; m; m = m >> 64n) len++
    uint.encode(state, len)
    const view = new DataView(state.buffer.buffer, state.start + state.buffer.byteOffset, 8 * len)
    for (let m = n, i = 0; m; m = m >> 64n, i += 8) {
      view.setBigUint64(i, BigInt.asUintN(64, m), true) // little endian
    }
    state.start += 8 * len
  },
  decode (state) {
    const len = uint.decode(state)
    if (state.end - state.start < 8 * len) throw new Error('Out of bounds')
    const view = new DataView(state.buffer.buffer, state.start + state.buffer.byteOffset, 8 * len)
    let n = 0n
    for (let i = len - 1; i >= 0; i--) n = (n << 64n) + view.getBigUint64(i * 8, true) // little endian
    state.start += 8 * len
    return n
  }
}

exports.bigint = zigZagBigInt(biguint)

exports.lexint = require('./lexint')

exports.float32 = {
  preencode (state, n) {
    state.end += 4
  },
  encode (state, n) {
    const view = new DataView(state.buffer.buffer, state.start + state.buffer.byteOffset, 4)
    view.setFloat32(0, n, true) // little endian
    state.start += 4
  },
  decode (state) {
    if (state.end - state.start < 4) throw new Error('Out of bounds')
    const view = new DataView(state.buffer.buffer, state.start + state.buffer.byteOffset, 4)
    const float = view.getFloat32(0, true) // little endian
    state.start += 4
    return float
  }
}

exports.float64 = {
  preencode (state, n) {
    state.end += 8
  },
  encode (state, n) {
    const view = new DataView(state.buffer.buffer, state.start + state.buffer.byteOffset, 8)
    view.setFloat64(0, n, true) // little endian
    state.start += 8
  },
  decode (state) {
    if (state.end - state.start < 8) throw new Error('Out of bounds')
    const view = new DataView(state.buffer.buffer, state.start + state.buffer.byteOffset, 8)
    const float = view.getFloat64(0, true) // little endian
    state.start += 8
    return float
  }
}

const buffer = exports.buffer = {
  preencode (state, b) {
    if (b) uint8array.preencode(state, b)
    else state.end++
  },
  encode (state, b) {
    if (b) uint8array.encode(state, b)
    else state.buffer[state.start++] = 0
  },
  decode (state) {
    const len = uint.decode(state)
    if (len === 0) return null
    if (state.end - state.start < len) throw new Error('Out of bounds')
    return state.buffer.subarray(state.start, (state.start += len))
  }
}

exports.binary = {
  ...buffer,
  preencode (state, b) {
    if (typeof b === 'string') utf8.preencode(state, b)
    else buffer.preencode(state, b)
  },
  encode (state, b) {
    if (typeof b === 'string') utf8.encode(state, b)
    else buffer.encode(state, b)
  }
}

exports.arraybuffer = {
  preencode (state, b) {
    uint.preencode(state, b.byteLength)
    state.end += b.byteLength
  },
  encode (state, b) {
    uint.encode(state, b.byteLength)

    const view = new Uint8Array(b)

    state.buffer.set(view, state.start)
    state.start += b.byteLength
  },
  decode (state) {
    const len = uint.decode(state)

    const b = new ArrayBuffer(len)
    const view = new Uint8Array(b)

    view.set(state.buffer.subarray(state.start, state.start += len))

    return b
  }
}

function typedarray (TypedArray, swap) {
  const n = TypedArray.BYTES_PER_ELEMENT

  return {
    preencode (state, b) {
      uint.preencode(state, b.length)
      state.end += b.byteLength
    },
    encode (state, b) {
      uint.encode(state, b.length)

      const view = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)

      if (BE && swap) swap(view)

      state.buffer.set(view, state.start)
      state.start += b.byteLength
    },
    decode (state) {
      const len = uint.decode(state)

      let b = state.buffer.subarray(state.start, state.start += len * n)
      if (b.byteLength !== len * n) throw new Error('Out of bounds')
      if ((b.byteOffset % n) !== 0) b = new Uint8Array(b)

      if (BE && swap) swap(b)

      return new TypedArray(b.buffer, b.byteOffset, b.byteLength / n)
    }
  }
}

const uint8array = exports.uint8array = typedarray(Uint8Array)
exports.uint16array = typedarray(Uint16Array, b4a.swap16)
exports.uint32array = typedarray(Uint32Array, b4a.swap32)

exports.int8array = typedarray(Int8Array)
exports.int16array = typedarray(Int16Array, b4a.swap16)
exports.int32array = typedarray(Int32Array, b4a.swap32)

exports.biguint64array = typedarray(BigUint64Array, b4a.swap64)
exports.bigint64array = typedarray(BigInt64Array, b4a.swap64)

exports.float32array = typedarray(Float32Array, b4a.swap32)
exports.float64array = typedarray(Float64Array, b4a.swap64)

function string (encoding) {
  return {
    preencode (state, s) {
      const len = b4a.byteLength(s, encoding)
      uint.preencode(state, len)
      state.end += len
    },
    encode (state, s) {
      const len = b4a.byteLength(s, encoding)
      uint.encode(state, len)
      b4a.write(state.buffer, s, state.start, encoding)
      state.start += len
    },
    decode (state) {
      const len = uint.decode(state)
      if (state.end - state.start < len) throw new Error('Out of bounds')
      return b4a.toString(state.buffer, encoding, state.start, (state.start += len))
    },
    fixed (n) {
      return {
        preencode (state) {
          state.end += n
        },
        encode (state, s) {
          b4a.write(state.buffer, s, state.start, n, encoding)
          state.start += n
        },
        decode (state) {
          if (state.end - state.start < n) throw new Error('Out of bounds')
          return b4a.toString(state.buffer, encoding, state.start, (state.start += n))
        }
      }
    }
  }
}

const utf8 = exports.string = exports.utf8 = string('utf-8')
exports.ascii = string('ascii')
exports.hex = string('hex')
exports.base64 = string('base64')
exports.ucs2 = exports.utf16le = string('utf16le')

exports.bool = {
  preencode (state, b) {
    state.end++
  },
  encode (state, b) {
    state.buffer[state.start++] = b ? 1 : 0
  },
  decode (state) {
    if (state.start >= state.end) throw Error('Out of bounds')
    return state.buffer[state.start++] === 1
  }
}

const fixed = exports.fixed = function fixed (n) {
  return {
    preencode (state, s) {
      if (s.byteLength !== n) throw new Error('Incorrect buffer size')
      state.end += n
    },
    encode (state, s) {
      state.buffer.set(s, state.start)
      state.start += n
    },
    decode (state) {
      if (state.end - state.start < n) throw new Error('Out of bounds')
      return state.buffer.subarray(state.start, (state.start += n))
    }
  }
}

exports.fixed32 = fixed(32)
exports.fixed64 = fixed(64)

exports.array = function array (enc) {
  return {
    preencode (state, list) {
      uint.preencode(state, list.length)
      for (let i = 0; i < list.length; i++) enc.preencode(state, list[i])
    },
    encode (state, list) {
      uint.encode(state, list.length)
      for (let i = 0; i < list.length; i++) enc.encode(state, list[i])
    },
    decode (state) {
      const len = uint.decode(state)
      if (len > 0x100000) throw new Error('Array is too big')
      const arr = new Array(len)
      for (let i = 0; i < len; i++) arr[i] = enc.decode(state)
      return arr
    }
  }
}

exports.frame = function frame (enc) {
  const dummy = exports.state()

  return {
    preencode (state, m) {
      const end = state.end
      enc.preencode(state, m)
      uint.preencode(state, state.end - end)
    },
    encode (state, m) {
      dummy.end = 0
      enc.preencode(dummy, m)
      uint.encode(state, dummy.end)
      enc.encode(state, m)
    },
    decode (state) {
      const end = state.end
      const len = uint.decode(state)
      state.end = state.start + len
      const m = enc.decode(state)
      state.start = state.end
      state.end = end
      return m
    }
  }
}

exports.date = {
  preencode (state, d) {
    int.preencode(state, d.getTime())
  },
  encode (state, d) {
    int.encode(state, d.getTime())
  },
  decode (state, d) {
    return new Date(int.decode(state))
  }
}

exports.json = {
  preencode (state, v) {
    utf8.preencode(state, JSON.stringify(v))
  },
  encode (state, v) {
    utf8.encode(state, JSON.stringify(v))
  },
  decode (state) {
    return JSON.parse(utf8.decode(state))
  }
}

exports.ndjson = {
  preencode (state, v) {
    utf8.preencode(state, JSON.stringify(v) + '\n')
  },
  encode (state, v) {
    utf8.encode(state, JSON.stringify(v) + '\n')
  },
  decode (state) {
    return JSON.parse(utf8.decode(state))
  }
}

// simple helper for when you want to just express nothing
exports.none = {
  preencode (state, n) {
    // do nothing
  },
  encode (state, n) {
    // do nothing
  },
  decode (state) {
    return null
  }
}

// "any" encoders here for helping just structure any object without schematising it

const anyArray = {
  preencode (state, arr) {
    uint.preencode(state, arr.length)
    for (let i = 0; i < arr.length; i++) {
      any.preencode(state, arr[i])
    }
  },
  encode (state, arr) {
    uint.encode(state, arr.length)
    for (let i = 0; i < arr.length; i++) {
      any.encode(state, arr[i])
    }
  },
  decode (state) {
    const arr = []
    let len = uint.decode(state)
    while (len-- > 0) {
      arr.push(any.decode(state))
    }
    return arr
  }
}

const anyObject = {
  preencode (state, o) {
    const keys = Object.keys(o)
    uint.preencode(state, keys.length)
    for (const key of keys) {
      utf8.preencode(state, key)
      any.preencode(state, o[key])
    }
  },
  encode (state, o) {
    const keys = Object.keys(o)
    uint.encode(state, keys.length)
    for (const key of keys) {
      utf8.encode(state, key)
      any.encode(state, o[key])
    }
  },
  decode (state) {
    let len = uint.decode(state)
    const o = {}
    while (len-- > 0) {
      const key = utf8.decode(state)
      o[key] = any.decode(state)
    }
    return o
  }
}

const anyTypes = [
  exports.none,
  exports.bool,
  exports.string,
  exports.buffer,
  exports.uint,
  exports.int,
  exports.float64,
  anyArray,
  anyObject,
  exports.date
]

const any = exports.any = {
  preencode (state, o) {
    const t = getType(o)
    uint.preencode(state, t)
    anyTypes[t].preencode(state, o)
  },
  encode (state, o) {
    const t = getType(o)
    uint.encode(state, t)
    anyTypes[t].encode(state, o)
  },
  decode (state) {
    const t = uint.decode(state)
    if (t >= anyTypes.length) throw new Error('Unknown type: ' + t)
    return anyTypes[t].decode(state)
  }
}

function getType (o) {
  if (o === null || o === undefined) return 0
  if (typeof o === 'boolean') return 1
  if (typeof o === 'string') return 2
  if (b4a.isBuffer(o)) return 3
  if (typeof o === 'number') {
    if (Number.isInteger(o)) return o >= 0 ? 4 : 5
    return 6
  }
  if (Array.isArray(o)) return 7
  if (o instanceof Date) return 9
  if (typeof o === 'object') return 8

  throw new Error('Unsupported type for ' + o)
}

exports.from = function from (enc) {
  if (typeof enc === 'string') return fromNamed(enc)
  if (enc.preencode) return enc
  if (enc.encodingLength) return fromAbstractEncoder(enc)
  return fromCodec(enc)
}

function fromNamed (enc) {
  switch (enc) {
    case 'ascii': return raw.ascii
    case 'utf-8':
    case 'utf8': return raw.utf8
    case 'hex': return raw.hex
    case 'base64': return raw.base64
    case 'utf16-le':
    case 'utf16le':
    case 'ucs-2':
    case 'ucs2': return raw.ucs2
    case 'ndjson': return raw.ndjson
    case 'json': return raw.json
    case 'binary':
    default: return raw.binary
  }
}

function fromCodec (enc) {
  let tmpM = null
  let tmpBuf = null

  return {
    preencode (state, m) {
      tmpM = m
      tmpBuf = enc.encode(m)
      state.end += tmpBuf.byteLength
    },
    encode (state, m) {
      raw.encode(state, m === tmpM ? tmpBuf : enc.encode(m))
      tmpM = tmpBuf = null
    },
    decode (state) {
      return enc.decode(raw.decode(state))
    }
  }
}

function fromAbstractEncoder (enc) {
  return {
    preencode (state, m) {
      state.end += enc.encodingLength(m)
    },
    encode (state, m) {
      enc.encode(m, state.buffer, state.start)
      state.start += enc.encode.bytes
    },
    decode (state) {
      const m = enc.decode(state.buffer, state.start, state.end)
      state.start += enc.decode.bytes
      return m
    }
  }
}

exports.encode = function encode (enc, m) {
  const state = exports.state()
  enc.preencode(state, m)
  state.buffer = b4a.allocUnsafe(state.end)
  enc.encode(state, m)
  return state.buffer
}

exports.decode = function decode (enc, buffer) {
  return enc.decode(exports.state(0, buffer.byteLength, buffer))
}

function zigZagInt (enc) {
  return {
    preencode (state, n) {
      enc.preencode(state, zigZagEncodeInt(n))
    },
    encode (state, n) {
      enc.encode(state, zigZagEncodeInt(n))
    },
    decode (state) {
      return zigZagDecodeInt(enc.decode(state))
    }
  }
}

function zigZagDecodeInt (n) {
  return n === 0 ? n : (n & 1) === 0 ? n / 2 : -(n + 1) / 2
}

function zigZagEncodeInt (n) {
  // 0, -1, 1, -2, 2, ...
  return n < 0 ? (2 * -n) - 1 : n === 0 ? 0 : 2 * n
}

function zigZagBigInt (enc) {
  return {
    preencode (state, n) {
      enc.preencode(state, zigZagEncodeBigInt(n))
    },
    encode (state, n) {
      enc.encode(state, zigZagEncodeBigInt(n))
    },
    decode (state) {
      return zigZagDecodeBigInt(enc.decode(state))
    }
  }
}

function zigZagDecodeBigInt (n) {
  return n === 0n ? n : (n & 1n) === 0n ? n / 2n : -(n + 1n) / 2n
}

function zigZagEncodeBigInt (n) {
  // 0, -1, 1, -2, 2, ...
  return n < 0n ? (2n * -n) - 1n : n === 0n ? 0n : 2n * n
}

function validateUint (n) {
  if ((n >= 0) === false /* Handles NaN as well */) throw new Error('uint must be positive')
}
