const hmacBlake2b = require('./hmac')
const b4a = require('b4a')

const HASHLEN = 64

module.exports = {
  hkdf,
  HASHLEN
}

// HMAC-based Extract-and-Expand KDF
// https://www.ietf.org/rfc/rfc5869.txt

function hkdf (salt, inputKeyMaterial, info = '', length = 2 * HASHLEN) {
  const pseudoRandomKey = hkdfExtract(salt, inputKeyMaterial)
  return hkdfExpand(pseudoRandomKey, info, length)
}

function hkdfExtract (salt, inputKeyMaterial) {
  const hmac = b4a.alloc(HASHLEN)
  return hmacDigest(hmac, salt, inputKeyMaterial)
}

function hkdfExpand (key, info, length) {
  // Put in dedicated slab to avoid keeping shared slab from being gc'ed
  const buffer = b4a.allocUnsafeSlow(length)

  const infoBuf = b4a.from(info)
  let prev = infoBuf

  const result = []
  for (let i = 0; i < length; i += HASHLEN) {
    const pos = b4a.from([(i / HASHLEN) + 1])

    const out = buffer.subarray(i, i + HASHLEN)
    result.push(out)

    prev = hmacDigest(out, key, [prev, infoBuf, pos])
  }

  return result
}

function hmacDigest (out, key, input) {
  hmacBlake2b(out, input, key)
  return out
}
