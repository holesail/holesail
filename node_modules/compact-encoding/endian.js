const LE = exports.LE = (new Uint8Array(new Uint16Array([0xff]).buffer))[0] === 0xff

exports.BE = !LE
