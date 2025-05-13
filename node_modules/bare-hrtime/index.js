const binding = require('./binding')

const EMPTY = Uint32Array.of(0, 0)

module.exports = exports = function hrtime(prev = EMPTY) {
  if (prev instanceof Uint32Array === false) prev = Uint32Array.from(prev)

  if (prev.length !== 2) {
    throw new Error('Previous timestamp must have two components')
  }

  return binding.hrtime(new Uint32Array(2), prev)
}

exports.bigint = binding.hrtimeBigint
