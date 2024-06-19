const z32 = require('z32')
const b4a = require('b4a')

module.exports = {
  encode,
  decode,
  normalize,
  isValid
}

function encode (key) {
  if (!b4a.isBuffer(key)) throw new Error('Key must be a Buffer')
  if (key.byteLength !== 32) throw new Error('Key must be 32-bytes long')
  return z32.encode(key)
}

function decode (id) {
  if (b4a.isBuffer(id)) {
    if (id.byteLength !== 32) throw new Error('ID must be 32-bytes long')
    return id
  }
  if (typeof id === 'string') {
    if (id.startsWith('pear://')) id = id.slice(7).split('/')[0]
    if (id.length === 52) return z32.decode(id)
    if (id.length === 64) {
      const buf = b4a.from(id, 'hex')
      if (buf.byteLength === 32) return buf
    }
  }
  throw new Error('Invalid Hypercore key')
}

function normalize (any) {
  return encode(decode(any))
}

function isValid (any) {
  try {
    decode(any)
    return true
  } catch {
    return false
  }
}
