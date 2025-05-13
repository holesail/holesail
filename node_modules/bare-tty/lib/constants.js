const binding = require('../binding')

module.exports = exports = {
  mode: {
    NORMAL: binding.MODE_NORMAL,
    RAW: binding.MODE_RAW,
    IO: binding.MODE_IO || 0
  },

  state: {
    READING: 0x1,
    CLOSING: 0x2
  }
}

/** @deprecated Use `mode.NORMAL` */
exports.MODE_NORMAL = exports.mode.NORMAL
/** @deprecated Use `mode.RAW` */
exports.MODE_RAW = exports.mode.RAW
/** @deprecated Use `mode.IO` */
exports.MODE_IO = exports.mode.IO
