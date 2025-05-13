const c = require('compact-encoding')

module.exports = function bitfield (length) {
  if (length > 64) throw new RangeError('Bitfield cannot be larger than 64 bits')

  let byteLength
  if (length < 8) byteLength = 1
  else if (length <= 16) byteLength = 2
  else if (length <= 32) byteLength = 4
  else byteLength = 8

  return {
    preencode (state) {
      state.end++ // Length byte, used for data when byteLength === 1

      if (byteLength === 1) ;
      else if (byteLength === 2) c.uint16.preencode(state)
      else if (byteLength === 4) c.uint32.preencode(state)
      else c.uint64.preencode(state)
    },

    encode (state, b) {
      if (byteLength === 1) ;
      else if (byteLength === 2) c.uint8.encode(state, 0xfd)
      else if (byteLength === 4) c.uint8.encode(state, 0xfe)
      else c.uint8.encode(state, 0xff)

      if (typeof b === 'number') {
        if (byteLength === 1) c.uint8.encode(state, b)
        else if (byteLength === 2) c.uint16.encode(state, b)
        else if (byteLength === 4) c.uint32.encode(state, b)
        else c.uint64.encode(state, b)
      } else {
        state.buffer.set(b, state.start)

        if (b.byteLength < byteLength) {
          // Zero-fill the rest of the byte length.
          state.buffer.fill(
            0,
            state.start + b.byteLength,
            state.start + byteLength
          )
        }

        state.start += byteLength
      }
    },

    decode (state) {
      const byte = state.buffer[state.start]

      let byteLength
      if (byte <= 0xfc) byteLength = 1
      else if (byte === 0xfd) byteLength = 2
      else if (byte === 0xfe) byteLength = 4
      else byteLength = 8

      if (byteLength > 1) state.start++ // Skip the length byte

      if (state.end - state.start < byteLength) throw new Error('Out of bounds')

      const b = state.buffer.subarray(state.start, (state.start += byteLength))

      return length <= 8 ? b.subarray(0, 1) : b
    }
  }
}
