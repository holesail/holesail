const b4a = require('b4a')

const { BE } = require('./endian')

exports = module.exports = {
  preencode (state, b) {
    state.end += b.byteLength
  },
  encode (state, b) {
    state.buffer.set(b, state.start)
    state.start += b.byteLength
  },
  decode (state) {
    const b = state.buffer.subarray(state.start, state.end)
    state.start = state.end
    return b
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
    const b = state.buffer.subarray(state.start)
    if (b.byteLength === 0) return null
    state.start = state.end
    return b
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
    state.end += b.byteLength
  },
  encode (state, b) {
    const view = new Uint8Array(b)

    state.buffer.set(view, state.start)
    state.start += b.byteLength
  },
  decode (state) {
    const b = new ArrayBuffer(state.end - state.start)
    const view = new Uint8Array(b)

    view.set(state.buffer.subarray(state.start))

    state.start = state.end

    return b
  }
}

function typedarray (TypedArray, swap) {
  const n = TypedArray.BYTES_PER_ELEMENT

  return {
    preencode (state, b) {
      state.end += b.byteLength
    },
    encode (state, b) {
      const view = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)

      if (BE && swap) swap(view)

      state.buffer.set(view, state.start)
      state.start += b.byteLength
    },
    decode (state) {
      let b = state.buffer.subarray(state.start)
      if ((b.byteOffset % n) !== 0) b = new Uint8Array(b)

      if (BE && swap) swap(b)

      state.start = state.end

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
      state.end += b4a.byteLength(s, encoding)
    },
    encode (state, s) {
      state.start += b4a.write(state.buffer, s, state.start, encoding)
    },
    decode (state) {
      const s = b4a.toString(state.buffer, encoding, state.start)
      state.start = state.end
      return s
    }
  }
}

const utf8 = exports.string = exports.utf8 = string('utf-8')
exports.ascii = string('ascii')
exports.hex = string('hex')
exports.base64 = string('base64')
exports.ucs2 = exports.utf16le = string('utf16le')

exports.array = function array (enc) {
  return {
    preencode (state, list) {
      for (const value of list) enc.preencode(state, value)
    },
    encode (state, list) {
      for (const value of list) enc.encode(state, value)
    },
    decode (state) {
      const arr = []
      while (state.start < state.end) arr.push(enc.decode(state))
      return arr
    }
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
