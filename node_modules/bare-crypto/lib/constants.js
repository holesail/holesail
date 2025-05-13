const binding = require('../binding')

module.exports = {
  hash: {
    MD5: binding.MD5,
    SHA1: binding.SHA1,
    SHA256: binding.SHA256,
    SHA512: binding.SHA512,
    BLAKE2B256: binding.BLAKE2B256
  }
}
