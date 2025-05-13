const sodium = require('sodium-universal')

function parseKeyPair (k) {
  const kp = JSON.parse(k)
  return {
    secretKey: Buffer.from(kp.secretKey, 'hex'),
    publicKey: Buffer.from(kp.publicKey, 'hex')
  }
}

function randomBytes (n) {
  const b = Buffer.alloc(n)
  sodium.randombytes_buf(b)
  return b
}

function findBuf (arr, buf) {
  return arr.findIndex(k => k.equals(buf)) >= 0
}

function checkAllowList (allow, k) {
  return findBuf(allow, k)
}

function prepKeyList (keys) {
  return keys.map(pk => prepKey(pk))
}

function prepKey (k) {
  return Buffer.from(k, 'hex')
}

module.exports = {
  checkAllowList,
  prepKeyList,
  prepKey,
  randomBytes,
  parseKeyPair
}
