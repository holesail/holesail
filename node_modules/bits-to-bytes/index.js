const b4a = require('b4a')

function byteLength (size) {
  return Math.ceil(size / 8)
}

function get (buffer, bit) {
  const n = buffer.BYTES_PER_ELEMENT * 8

  const offset = bit & (n - 1)
  const i = (bit - offset) / n

  return (buffer[i] & (1 << offset)) !== 0
}

function set (buffer, bit, value = true) {
  const n = buffer.BYTES_PER_ELEMENT * 8

  const offset = bit & (n - 1)
  const i = (bit - offset) / n
  const mask = 1 << offset

  if (value) {
    if ((buffer[i] & mask) !== 0) return false
  } else {
    if ((buffer[i] & mask) === 0) return false
  }

  buffer[i] ^= mask
  return true
}

function setRange (buffer, start, end, value = true) {
  const n = buffer.BYTES_PER_ELEMENT * 8

  let remaining = end - start
  let offset = start & (n - 1)
  let i = (start - offset) / n

  let changed = false

  while (remaining > 0) {
    const mask = (2 ** Math.min(remaining, n - offset) - 1) << offset

    if (value) {
      if ((buffer[i] & mask) !== mask) {
        buffer[i] |= mask
        changed = true
      }
    } else {
      if ((buffer[i] & mask) !== 0) {
        buffer[i] &= ~mask
        changed = true
      }
    }

    remaining -= n - offset
    offset = 0
    i++
  }

  return changed
}

function fill (buffer, value, start = 0, end = buffer.byteLength * 8) {
  const n = buffer.BYTES_PER_ELEMENT * 8
  let i, j

  {
    const offset = start & (n - 1)
    i = (start - offset) / n

    if (offset !== 0) {
      const mask = (2 ** Math.min(n - offset, end - start) - 1) << offset

      if (value) buffer[i] |= mask
      else buffer[i] &= ~mask

      i++
    }
  }

  {
    const offset = end & (n - 1)
    j = (end - offset) / n

    if (offset !== 0 && j >= i) {
      const mask = (2 ** offset) - 1

      if (value) buffer[j] |= mask
      else buffer[j] &= ~mask
    }
  }

  return buffer.fill(value ? (2 ** n) - 1 : 0, i, j)
}

function toggle (buffer, bit) {
  const n = buffer.BYTES_PER_ELEMENT * 8

  const offset = bit & (n - 1)
  const i = (bit - offset) / n
  const mask = 1 << offset

  buffer[i] ^= mask
  return (buffer[i] & mask) !== 0
}

function remove (buffer, bit) {
  return set(buffer, bit, false)
}

function removeRange (buffer, start, end) {
  return setRange(buffer, start, end, false)
}

function indexOf (buffer, value, position = 0) {
  for (let i = position, n = buffer.byteLength * 8; i < n; i++) {
    if (get(buffer, i) === value) return i
  }

  return -1
}

function lastIndexOf (buffer, value, position = buffer.byteLength * 8 - 1) {
  for (let i = position; i >= 0; i--) {
    if (get(buffer, i) === value) return i
  }

  return -1
}

function of (...bits) {
  return from(bits)
}

function from (bits) {
  const buffer = b4a.alloc(byteLength(bits.length))
  for (let i = 0; i < bits.length; i++) set(buffer, i, bits[i])
  return buffer
}

function * iterator (buffer) {
  for (let i = 0, n = buffer.byteLength * 8; i < n; i++) yield get(buffer, i)
}

module.exports = {
  byteLength,
  get,
  set,
  setRange,
  fill,
  toggle,
  remove,
  removeRange,
  indexOf,
  lastIndexOf,
  of,
  from,
  iterator
}
