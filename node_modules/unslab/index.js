const b4a = require('b4a')

unslab.all = all
unslab.is = is

module.exports = unslab

function unslab (buf) {
  if (buf === null || buf.buffer.byteLength === buf.byteLength) return buf
  const copy = b4a.allocUnsafeSlow(buf.byteLength)
  copy.set(buf, 0)
  return copy
}

function is (buf) {
  return buf.buffer.byteLength !== buf.byteLength
}

function all (list) {
  let size = 0
  for (let i = 0; i < list.length; i++) {
    const buf = list[i]
    size += buf === null || buf.buffer.byteLength === buf.byteLength ? 0 : buf.byteLength
  }

  const copy = b4a.allocUnsafeSlow(size)
  const result = new Array(list.length)

  let offset = 0
  for (let i = 0; i < list.length; i++) {
    let buf = list[i]

    if (buf !== null && buf.buffer.byteLength !== buf.byteLength) {
      copy.set(buf, offset)
      buf = copy.subarray(offset, offset += buf.byteLength)
    }

    result[i] = buf
  }

  return result
}
