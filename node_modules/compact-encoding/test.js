const enc = require('./')
const test = require('brittle')
const b4a = require('b4a')

test('uint', function (t) {
  const state = enc.state()

  enc.uint.preencode(state, 42)
  t.alike(state, enc.state(0, 1))
  enc.uint.preencode(state, 4200)
  t.alike(state, enc.state(0, 4))
  enc.uint.preencode(state, Number.MAX_SAFE_INTEGER)
  t.alike(state, enc.state(0, 13))

  state.buffer = b4a.alloc(state.end)
  enc.uint.encode(state, 42)
  t.alike(state, enc.state(1, 13, b4a.from([42, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])))
  enc.uint.encode(state, 4200)
  t.alike(state, enc.state(4, 13, b4a.from([42, 0xfd, 104, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0])))
  enc.uint.encode(state, Number.MAX_SAFE_INTEGER)
  t.alike(state, enc.state(13, 13, b4a.from([42, 0xfd, 104, 16, 0xff, 255, 255, 255, 255, 255, 255, 31, 0])))

  state.start = 0
  t.is(enc.uint.decode(state), 42)
  t.is(enc.uint.decode(state), 4200)
  t.is(enc.uint.decode(state), Number.MAX_SAFE_INTEGER)
  t.is(state.start, state.end)

  t.exception(() => enc.uint.decode(state))
})

test('int', function (t) {
  const state = enc.state()

  enc.int.preencode(state, 42)
  t.alike(state, enc.state(0, 1))
  enc.int.preencode(state, -4200)
  t.alike(state, enc.state(0, 4))

  state.buffer = b4a.alloc(state.end)
  enc.int.encode(state, 42)
  t.alike(state, enc.state(1, 4, b4a.from([84, 0, 0, 0])))
  enc.int.encode(state, -4200)
  t.alike(state, enc.state(4, 4, b4a.from([84, 0xfd, 207, 32])))

  state.start = 0
  t.is(enc.int.decode(state), 42)
  t.is(enc.int.decode(state), -4200)
  t.is(state.start, state.end)

  t.exception(() => enc.int.decode(state))
})

test('float64', function (t) {
  const state = enc.state()

  enc.float64.preencode(state, 162.2377294)
  t.alike(state, enc.state(0, 8))

  state.buffer = b4a.alloc(state.end)
  t.alike(state, enc.state(0, 8, b4a.from([0, 0, 0, 0, 0, 0, 0, 0])))
  enc.float64.encode(state, 162.2377294)
  t.alike(state, enc.state(8, 8, b4a.from([0x87, 0xc9, 0xaf, 0x7a, 0x9b, 0x47, 0x64, 0x40])))

  state.start = 0
  t.is(enc.float64.decode(state), 162.2377294)
  t.is(state.start, state.end)

  t.exception(() => enc.float64.decode(state))

  // alignement
  state.start = 0
  state.end = 0
  state.buffer = null

  enc.int.preencode(state, 0)
  enc.float64.preencode(state, 162.2377294)
  t.alike(state, enc.state(0, 9))

  state.buffer = b4a.alloc(state.end)
  t.alike(state, enc.state(0, 9, b4a.from([0, 0, 0, 0, 0, 0, 0, 0, 0])))
  enc.int.encode(state, 0)
  enc.float64.encode(state, 162.2377294)
  t.alike(state, enc.state(9, 9, b4a.from([0, 0x87, 0xc9, 0xaf, 0x7a, 0x9b, 0x47, 0x64, 0x40])))

  state.start = 0
  t.is(enc.int.decode(state), 0)
  t.is(enc.float64.decode(state), 162.2377294)
  t.is(state.start, state.end)

  // subarray
  const buf = b4a.alloc(10)
  state.start = 0
  state.buffer = buf.subarray(1)
  t.alike(state, enc.state(0, 9, b4a.from([0, 0, 0, 0, 0, 0, 0, 0, 0])))
  enc.int.encode(state, 0)
  enc.float64.encode(state, 162.2377294)
  t.alike(state, enc.state(9, 9, b4a.from([0, 0x87, 0xc9, 0xaf, 0x7a, 0x9b, 0x47, 0x64, 0x40])))
  t.alike(buf, b4a.from([0, 0, 0x87, 0xc9, 0xaf, 0x7a, 0x9b, 0x47, 0x64, 0x40]))

  state.start = 0
  t.is(enc.int.decode(state), 0)
  t.is(enc.float64.decode(state), 162.2377294)
  t.is(state.start, state.end)

  // 0
  state.start = 0
  state.end = 0
  state.buffer = null

  enc.float64.preencode(state, 162.2377294)
  state.buffer = b4a.alloc(state.end)
  enc.float64.encode(state, 0)
  t.alike(state, enc.state(8, 8, b4a.from([0, 0, 0, 0, 0, 0, 0, 0])))

  state.start = 0
  t.is(enc.float64.decode(state), 0)
  t.is(state.start, state.end)

  // Infinity
  state.start = 0
  state.end = 0
  state.buffer = null

  enc.float64.preencode(state, Infinity)
  state.buffer = b4a.alloc(state.end)
  enc.float64.encode(state, Infinity)
  t.alike(state, enc.state(8, 8, b4a.from([0, 0, 0, 0, 0, 0, 0xf0, 0x7f])))

  state.start = 0
  t.is(enc.float64.decode(state), Infinity)
  t.is(state.start, state.end)

  // Edge cases
  state.start = 0
  state.end = 0
  state.buffer = null

  enc.float64.preencode(state, 0.1 + 0.2)
  state.buffer = b4a.alloc(state.end)
  enc.float64.encode(state, 0.1 + 0.2)
  t.alike(state, enc.state(8, 8, b4a.from([0x34, 0x33, 0x33, 0x33, 0x33, 0x33, 0xd3, 0x3f])))

  state.start = 0
  t.is(enc.float64.decode(state), 0.1 + 0.2)
  t.is(state.start, state.end)
})

test('biguint64', function (t) {
  const state = enc.state()

  const n = 0x0102030405060708n

  enc.biguint64.preencode(state, n)
  t.alike(state, enc.state(0, 8))

  state.buffer = b4a.alloc(state.end)
  enc.biguint64.encode(state, n)
  t.alike(state, enc.state(8, 8, b4a.from([0x8, 0x7, 0x6, 0x5, 0x4, 0x3, 0x2, 0x1])))

  state.start = 0
  t.is(enc.biguint64.decode(state), n)
  t.is(state.start, state.end)

  t.exception(() => enc.biguint64.decode(state))
})

test('bigint64', function (t) {
  const state = enc.state()

  const n = -0x0102030405060708n

  enc.bigint64.preencode(state, n)
  t.alike(state, enc.state(0, 8))

  state.buffer = b4a.alloc(state.end)
  enc.bigint64.encode(state, n)
  t.alike(state, enc.state(8, 8, b4a.from([0xf, 0xe, 0xc, 0xa, 0x8, 0x6, 0x4, 0x2])))

  state.start = 0
  t.is(enc.bigint64.decode(state), n)
  t.is(state.start, state.end)

  t.exception(() => enc.bigint64.decode(state))
})

test('biguint', function (t) {
  const state = enc.state()

  const n = 0x0102030405060708090a0b0cn

  enc.biguint.preencode(state, n)
  t.alike(state, enc.state(0, 17))

  state.buffer = b4a.alloc(state.end)
  enc.biguint.encode(state, n)
  t.alike(state, enc.state(17, 17, b4a.from([2, 0xc, 0xb, 0xa, 0x9, 0x8, 0x7, 0x6, 0x5, 0x4, 0x3, 0x2, 0x1, 0x0, 0x0, 0x0, 0x0])))

  state.start = 0
  t.is(enc.biguint.decode(state), n)
  t.is(state.start, state.end)

  t.exception(() => enc.biguint.decode(state))
})

test('bigint', function (t) {
  const state = enc.state()

  const n = -0x0102030405060708090a0b0cn

  enc.bigint.preencode(state, n)
  t.alike(state, enc.state(0, 17))

  state.buffer = b4a.alloc(state.end)
  enc.bigint.encode(state, n)
  t.alike(state, enc.state(17, 17, b4a.from([2, 0x17, 0x16, 0x14, 0x12, 0x10, 0xe, 0xc, 0xa, 0x8, 0x6, 0x4, 0x2, 0x0, 0x0, 0x0, 0x0])))

  state.start = 0
  t.is(enc.bigint.decode(state), n)
  t.is(state.start, state.end)

  t.exception(() => enc.bigint.decode(state))
})

test('buffer', function (t) {
  const state = enc.state()

  enc.buffer.preencode(state, b4a.from('hi'))
  t.alike(state, enc.state(0, 3))
  enc.buffer.preencode(state, b4a.from('hello'))
  t.alike(state, enc.state(0, 9))
  enc.buffer.preencode(state, null)
  t.alike(state, enc.state(0, 10))

  state.buffer = b4a.alloc(state.end)
  enc.buffer.encode(state, b4a.from('hi'))
  t.alike(state, enc.state(3, 10, b4a.from('\x02hi\x00\x00\x00\x00\x00\x00\x00')))
  enc.buffer.encode(state, b4a.from('hello'))
  t.alike(state, enc.state(9, 10, b4a.from('\x02hi\x05hello\x00')))
  enc.buffer.encode(state, null)
  t.alike(state, enc.state(10, 10, b4a.from('\x02hi\x05hello\x00')))

  state.start = 0
  t.alike(enc.buffer.decode(state), b4a.from('hi'))
  t.alike(enc.buffer.decode(state), b4a.from('hello'))
  t.is(enc.buffer.decode(state), null)
  t.is(state.start, state.end)

  t.exception(() => enc.buffer.decode(state))
})

test('arraybuffer', function (t) {
  const state = enc.state()

  const b1 = new ArrayBuffer(4)
  b4a.from(b1).fill('a')

  const b2 = new ArrayBuffer(8)
  b4a.from(b2).fill('b')

  enc.arraybuffer.preencode(state, b1)
  t.alike(state, enc.state(0, 5))
  enc.arraybuffer.preencode(state, b2)
  t.alike(state, enc.state(0, 14))

  state.buffer = b4a.alloc(state.end)
  enc.arraybuffer.encode(state, b1)
  t.alike(state, enc.state(5, 14, b4a.from('\x04aaaa\x00\x00\x00\x00\x00\x00\x00\x00\x00')))
  enc.arraybuffer.encode(state, b2)
  t.alike(state, enc.state(14, 14, b4a.from('\x04aaaa\x08bbbbbbbb')))

  state.start = 0
  t.alike(enc.arraybuffer.decode(state), b1)
  t.alike(enc.arraybuffer.decode(state), b2)
  t.is(state.start, state.end)

  t.exception(() => enc.arraybuffer.decode(state))
})

test('raw', function (t) {
  const state = enc.state()

  enc.raw.preencode(state, b4a.from('hi'))
  t.alike(state, enc.state(0, 2))

  state.buffer = b4a.alloc(state.end)
  enc.raw.encode(state, b4a.from('hi'))
  t.alike(state, enc.state(2, 2, b4a.from('hi')))

  state.start = 0
  t.alike(enc.raw.decode(state), b4a.from('hi'))
  t.is(state.start, state.end)
})

test('raw uint8array', function (t) {
  const state = enc.state()

  enc.raw.uint8array.preencode(state, Uint8Array.of(1, 2))
  t.alike(state, enc.state(0, 2))
  enc.raw.uint8array.preencode(state, Uint8Array.of(3, 4))
  t.alike(state, enc.state(0, 4))

  state.buffer = b4a.alloc(state.end)
  enc.raw.uint8array.encode(state, Uint8Array.of(1, 2))
  t.alike(state, enc.state(2, 4, b4a.from([1, 2, 0, 0])))
  enc.raw.uint8array.encode(state, Uint8Array.of(3, 4))
  t.alike(state, enc.state(4, 4, b4a.from([1, 2, 3, 4])))

  state.start = 0
  t.alike(enc.raw.uint8array.decode(state), Uint8Array.of(1, 2, 3, 4))
  t.alike(enc.raw.uint8array.decode(state), Uint8Array.of())
})

test('uint16array', function (t) {
  const state = enc.state()

  enc.uint16array.preencode(state, new Uint16Array([1, 2, 3]))
  t.alike(state, enc.state(0, 7))

  state.buffer = b4a.alloc(state.end)
  enc.uint16array.encode(state, new Uint16Array([1, 2, 3]))
  t.alike(state, enc.state(7, 7, b4a.from([3, 1, 0, 2, 0, 3, 0])))

  state.start = 0
  t.alike(enc.uint16array.decode(state), new Uint16Array([1, 2, 3]))
  t.is(state.start, state.end)

  t.exception(() => enc.uint16array.decode(state))
})

test('uint32array', function (t) {
  const state = enc.state()

  enc.uint32array.preencode(state, new Uint32Array([1]))
  t.alike(state, enc.state(0, 5))
  enc.uint32array.preencode(state, new Uint32Array([42, 43]))
  t.alike(state, enc.state(0, 14))

  state.buffer = b4a.alloc(state.end)
  enc.uint32array.encode(state, new Uint32Array([1]))
  t.alike(state, enc.state(5, 14, b4a.from([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])))
  enc.uint32array.encode(state, new Uint32Array([42, 43]))
  t.alike(state, enc.state(14, 14, b4a.from([1, 1, 0, 0, 0, 2, 42, 0, 0, 0, 43, 0, 0, 0])))

  state.start = 0
  t.alike(enc.uint32array.decode(state), new Uint32Array([1]))
  t.alike(enc.uint32array.decode(state), new Uint32Array([42, 43]))
  t.is(state.start, state.end)

  t.exception(() => enc.uint32array.decode(state))
})

test('int16array', function (t) {
  const state = enc.state()

  enc.int16array.preencode(state, new Int16Array([1, -2, 3]))
  t.alike(state, enc.state(0, 7))

  state.buffer = b4a.alloc(state.end)
  enc.int16array.encode(state, new Int16Array([1, -2, 3]))
  t.alike(state, enc.state(7, 7, b4a.from([3, 1, 0, 0xfe, 0xff, 3, 0])))

  state.start = 0
  t.alike(enc.int16array.decode(state), new Int16Array([1, -2, 3]))
  t.is(state.start, state.end)

  t.exception(() => enc.int16array.decode(state))
})

test('int32array', function (t) {
  const state = enc.state()

  enc.int32array.preencode(state, new Int32Array([1, -2, 3]))
  t.alike(state, enc.state(0, 13))

  state.buffer = b4a.alloc(state.end)
  enc.int32array.encode(state, new Int32Array([1, -2, 3]))
  t.alike(state, enc.state(13, 13, b4a.from([3, 1, 0, 0, 0, 0xfe, 0xff, 0xff, 0xff, 3, 0, 0, 0])))

  state.start = 0
  t.alike(enc.int32array.decode(state), new Int32Array([1, -2, 3]))
  t.is(state.start, state.end)

  t.exception(() => enc.int32array.decode(state))
})

test('biguint64array', function (t) {
  const state = enc.state()

  const arr = new BigUint64Array([0x01020304n, 0x05060708n, 0x090a0b0cn])

  enc.biguint64array.preencode(state, arr)
  t.alike(state, enc.state(0, 25))

  state.buffer = b4a.alloc(state.end)
  enc.biguint64array.encode(state, arr)
  t.alike(state, enc.state(25, 25, b4a.from([3, 0x4, 0x3, 0x2, 0x1, 0x0, 0x0, 0x0, 0x0, 0x8, 0x7, 0x6, 0x5, 0x0, 0x0, 0x0, 0x0, 0xc, 0xb, 0xa, 0x9, 0x0, 0x0, 0x0, 0x0])))

  state.start = 0
  t.alike(enc.biguint64array.decode(state), arr)
  t.is(state.start, state.end)

  t.exception(() => enc.biguint64array.decode(state))
})

test('bigint64array', function (t) {
  const state = enc.state()

  const arr = new BigInt64Array([-0x01020304n, 0x05060708n, -0x090a0b0cn])

  enc.bigint64array.preencode(state, arr)
  t.alike(state, enc.state(0, 25))

  state.buffer = b4a.alloc(state.end)
  enc.bigint64array.encode(state, arr)
  t.alike(state, enc.state(25, 25, b4a.from([3, 0xfc, 0xfc, 0xfd, 0xfe, 0xff, 0xff, 0xff, 0xff, 0x8, 0x7, 0x6, 0x5, 0x0, 0x0, 0x0, 0x0, 0xf4, 0xf4, 0xf5, 0xf6, 0xff, 0xff, 0xff, 0xff])))

  state.start = 0
  t.alike(enc.bigint64array.decode(state), arr)
  t.is(state.start, state.end)

  t.exception(() => enc.bigint64array.decode(state))
})

test('float32array', function (t) {
  const state = enc.state()

  enc.float32array.preencode(state, new Float32Array([1.1, -2.2, 3.3]))
  t.alike(state, enc.state(0, 13))

  state.buffer = b4a.alloc(state.end)
  enc.float32array.encode(state, new Float32Array([1.1, -2.2, 3.3]))
  t.alike(state, enc.state(13, 13, b4a.from([3, 0xcd, 0xcc, 0x8c, 0x3f, 0xcd, 0xcc, 0x0c, 0xc0, 0x33, 0x33, 0x53, 0x40])))

  state.start = 0
  t.alike(enc.float32array.decode(state), new Float32Array([1.1, -2.2, 3.3]))
  t.is(state.start, state.end)

  t.exception(() => enc.float32array.decode(state))
})

test('float64array', function (t) {
  const state = enc.state()

  enc.float64array.preencode(state, new Float64Array([1.1, -2.2, 3.3]))
  t.alike(state, enc.state(0, 25))

  state.buffer = b4a.alloc(state.end)
  enc.float64array.encode(state, new Float64Array([1.1, -2.2, 3.3]))
  t.alike(state, enc.state(25, 25, b4a.from([3, 0x9a, 0x99, 0x99, 0x99, 0x99, 0x99, 0xf1, 0x3f, 0x9a, 0x99, 0x99, 0x99, 0x99, 0x99, 0x01, 0xc0, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x0a, 0x40])))

  state.start = 0
  t.alike(enc.float64array.decode(state), new Float64Array([1.1, -2.2, 3.3]))
  t.is(state.start, state.end)

  t.exception(() => enc.float64array.decode(state))
})

test('string', function (t) {
  const state = enc.state()

  enc.string.preencode(state, '🌾')
  t.alike(state, enc.state(0, 5))
  enc.string.preencode(state, 'høsten er fin')
  t.alike(state, enc.state(0, 20))

  state.buffer = b4a.alloc(state.end)
  enc.string.encode(state, '🌾')
  t.alike(state, enc.state(5, 20, b4a.from('\x04🌾\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')))
  enc.string.encode(state, 'høsten er fin')
  t.alike(state, enc.state(20, 20, b4a.from('\x04🌾\x0ehøsten er fin')))

  state.start = 0
  t.is(enc.string.decode(state), '🌾')
  t.is(enc.string.decode(state), 'høsten er fin')
  t.is(state.start, state.end)

  t.exception(() => enc.string.decode(state))
})

test('raw string', function (t) {
  const state = enc.state()

  enc.raw.string.preencode(state, 'hello')
  t.alike(state, enc.state(0, 5))
  enc.raw.string.preencode(state, ' world')
  t.alike(state, enc.state(0, 11))

  state.buffer = b4a.alloc(state.end)
  enc.raw.string.encode(state, 'hello')
  enc.raw.string.encode(state, ' world')
  t.alike(state, enc.state(11, 11, b4a.from('hello world')))

  state.start = 0
  t.is(enc.raw.string.decode(state), 'hello world')
  t.is(enc.raw.string.decode(state), '')
})

test('fixed32', function (t) {
  const state = enc.state()

  enc.fixed32.preencode(state, b4a.alloc(32).fill('a'))
  t.alike(state, enc.state(0, 32))
  enc.fixed32.preencode(state, b4a.alloc(32).fill('b'))
  t.alike(state, enc.state(0, 64))

  state.buffer = b4a.alloc(state.end)
  enc.fixed32.encode(state, b4a.alloc(32).fill('a'))
  t.alike(state, enc.state(32, 64, b4a.alloc(64).fill('a', 0, 32)))
  enc.fixed32.encode(state, b4a.alloc(32).fill('b'))
  t.alike(state, enc.state(64, 64, b4a.alloc(64).fill('a', 0, 32).fill('b', 32, 64)))

  state.start = 0
  t.alike(enc.fixed32.decode(state), b4a.alloc(32).fill('a'))
  t.alike(enc.fixed32.decode(state), b4a.alloc(32).fill('b'))
  t.is(state.start, state.end)

  t.exception(() => enc.fixed32.decode(state))
})

test('fixed64', function (t) {
  const state = enc.state()

  enc.fixed64.preencode(state, b4a.alloc(64).fill('a'))
  t.alike(state, enc.state(0, 64))
  enc.fixed64.preencode(state, b4a.alloc(64).fill('b'))
  t.alike(state, enc.state(0, 128))

  state.buffer = b4a.alloc(state.end)
  enc.fixed64.encode(state, b4a.alloc(64).fill('a'))
  t.alike(state, enc.state(64, 128, b4a.alloc(128).fill('a', 0, 64)))
  enc.fixed64.encode(state, b4a.alloc(64).fill('b'))
  t.alike(state, enc.state(128, 128, b4a.alloc(128).fill('a', 0, 64).fill('b', 64, 128)))

  state.start = 0
  t.alike(enc.fixed64.decode(state), b4a.alloc(64).fill('a'))
  t.alike(enc.fixed64.decode(state), b4a.alloc(64).fill('b'))
  t.is(state.start, state.end)

  t.exception(() => enc.fixed64.decode(state))
})

test('fixed n', function (t) {
  const state = enc.state()
  const fixed = enc.fixed(3)

  fixed.preencode(state, b4a.alloc(3).fill('a'))
  t.alike(state, enc.state(0, 3))
  fixed.preencode(state, b4a.alloc(3).fill('b'))
  t.alike(state, enc.state(0, 6))

  state.buffer = b4a.alloc(state.end)
  fixed.encode(state, b4a.alloc(3).fill('a'))
  t.alike(state, enc.state(3, 6, b4a.alloc(6).fill('a', 0, 3)))
  fixed.encode(state, b4a.alloc(3).fill('b'))
  t.alike(state, enc.state(6, 6, b4a.alloc(6).fill('a', 0, 3).fill('b', 3, 6)))

  state.start = 0
  t.alike(fixed.decode(state), b4a.alloc(3).fill('a'))
  t.alike(fixed.decode(state), b4a.alloc(3).fill('b'))
  t.is(state.start, state.end)

  t.exception(() => fixed.decode(state))
  state.start = 4
  t.exception(() => fixed.decode(state))
})

test('error for incorrect buffer sizes when encoding fixed-length buffers', function (t) {
  const smallbuf = b4a.from('aa', 'hex')
  const bigBuf = b4a.from('aa'.repeat(500), 'hex')

  t.exception(() => enc.encode(enc.fixed32, smallbuf), /Incorrect buffer size/)
  t.exception(() => enc.encode(enc.fixed64, smallbuf), /Incorrect buffer size/)
  t.exception(() => enc.encode(enc.fixed(100), smallbuf), /Incorrect buffer size/)

  t.exception(() => enc.encode(enc.fixed32, bigBuf), /Incorrect buffer size/)
  t.exception(() => enc.encode(enc.fixed64, bigBuf), /Incorrect buffer size/)
  t.exception(() => enc.encode(enc.fixed(100), bigBuf), /Incorrect buffer size/)
})

test('array', function (t) {
  const state = enc.state()
  const arr = enc.array(enc.bool)

  arr.preencode(state, [true, false, true])
  t.alike(state, enc.state(0, 4))
  arr.preencode(state, [false, false, true, true])
  t.alike(state, enc.state(0, 9))

  state.buffer = b4a.alloc(state.end)
  arr.encode(state, [true, false, true])
  t.alike(state, enc.state(4, 9, b4a.from([3, 1, 0, 1, 0, 0, 0, 0, 0])))
  arr.encode(state, [false, false, true, true])
  t.alike(state, enc.state(9, 9, b4a.from([3, 1, 0, 1, 4, 0, 0, 1, 1])))

  state.start = 0
  t.alike(arr.decode(state), [true, false, true])
  t.alike(arr.decode(state), [false, false, true, true])
  t.is(state.start, state.end)

  t.exception(() => arr.decode(state))
})

test('raw array', function (t) {
  const state = enc.state()
  const arr = enc.raw.array(enc.bool)

  arr.preencode(state, [true])
  t.alike(state, enc.state(0, 1))
  arr.preencode(state, [true])
  t.alike(state, enc.state(0, 2))

  state.buffer = b4a.alloc(state.end)
  arr.encode(state, [true])
  t.alike(state, enc.state(1, 2, b4a.from([1, 0])))
  arr.encode(state, [true])
  t.alike(state, enc.state(2, 2, b4a.from([1, 1])))

  state.start = 0
  t.alike(arr.decode(state), [true, true])
  t.alike(arr.decode(state), [])
})

test('json', function (t) {
  const state = enc.state()

  enc.json.preencode(state, { a: 1, b: 2 })
  t.alike(state, enc.state(0, 14))

  state.buffer = b4a.alloc(state.end)
  enc.json.encode(state, { a: 1, b: 2 })
  t.alike(state, enc.state(14, 14, b4a.concat([
    b4a.from([13]),
    b4a.from('{"a":1,"b":2}')
  ])))

  state.start = 0
  t.alike(enc.json.decode(state), { a: 1, b: 2 })

  t.exception(() => enc.json.decode(state))
})

test('raw json', function (t) {
  const state = enc.state()

  enc.raw.json.preencode(state, { a: 1, b: 2 })
  t.alike(state, enc.state(0, 13))

  state.buffer = b4a.alloc(state.end)
  enc.raw.json.encode(state, { a: 1, b: 2 })
  t.alike(state, enc.state(13, 13, b4a.from('{"a":1,"b":2}')))

  state.start = 0
  t.alike(enc.raw.json.decode(state), { a: 1, b: 2 })

  t.exception(() => enc.json.decode(state))
})

test('lexint: big numbers', function (t) {
  t.plan(1)

  let prev = enc.encode(enc.lexint, 0)

  let n
  let skip = 1

  for (n = 1; n < Number.MAX_VALUE; n += skip) {
    const cur = enc.encode(enc.lexint, n)
    if (b4a.compare(cur, prev) < 1) break
    prev = cur
    skip = 1 + Math.pow(245, Math.ceil(Math.log(n) / Math.log(256)))
  }
  t.is(n, Infinity)
})

test('lexint: range precision', function (t) {
  t.plan(2)
  const a = 1e55
  const b = 1.0000000000001e55
  const ha = enc.encode(enc.lexint, a).toString('hex')
  const hb = enc.encode(enc.lexint, b).toString('hex')
  t.not(a, b)
  t.not(ha, hb)
})

test('lexint: range precision', function (t) {
  let prev = enc.encode(enc.lexint, 0)
  const skip = 0.000000001e55
  for (let i = 0, n = 1e55; i < 1000; n = 1e55 + skip * ++i) {
    const cur = enc.encode(enc.lexint, n)
    if (b4a.compare(cur, prev) < 1) t.fail('cur <= prev')
    prev = cur
  }
  t.ok(true)
  t.end()
})

test('lexint: small numbers', function (t) {
  let prev = enc.encode(enc.lexint, 0)
  for (let n = 1; n < 256 * 256 * 16; n++) {
    const cur = enc.encode(enc.lexint, n)
    if (b4a.compare(cur, prev) < 1) t.fail('cur <= prev')
    prev = cur
  }
  t.ok(true)
  t.end()
})

test('lexint: throws', function (t) {
  t.exception(() => {
    enc.decode(enc.lexint, b4a.alloc(1, 251))
  })

  let num = 252

  const state = enc.state()

  enc.lexint.preencode(state, num)
  state.buffer = b4a.alloc(state.end - state.start)
  enc.lexint.encode(state, num)

  t.exception(() => {
    enc.decode(enc.lexint, state.buffer.subarray(0, state.buffer.byteLength - 2))
  })

  num <<= 8

  state.start = 0
  state.end = 0
  state.buffer = null

  enc.lexint.preencode(state, num)
  state.buffer = b4a.alloc(state.end - state.start)
  enc.lexint.encode(state, num)

  t.exception(() => {
    enc.decode(enc.lexint, state.buffer.subarray(0, state.buffer.byteLength - 2))
  })

  num <<= 8

  state.start = 0
  state.end = 0
  state.buffer = null

  enc.lexint.preencode(state, num)
  state.buffer = b4a.alloc(state.end - state.start)
  enc.lexint.encode(state, num)

  t.exception(() => {
    enc.decode(enc.lexint, state.buffer.subarray(0, state.buffer.byteLength - 2))
  })

  num *= 256

  state.start = 0
  state.end = 0
  state.buffer = null

  enc.lexint.preencode(state, num)
  state.buffer = b4a.alloc(state.end - state.start)
  enc.lexint.encode(state, num)

  t.exception(() => {
    enc.decode(enc.lexint, state.buffer.subarray(0, state.buffer.byteLength - 2))
  })

  num *= 256 * 256

  state.start = 0
  state.end = 0
  state.buffer = null

  enc.lexint.preencode(state, num)
  state.buffer = b4a.alloc(state.end - state.start)
  enc.lexint.encode(state, num)

  t.exception(() => {
    enc.decode(enc.lexint, state.buffer.subarray(0, state.buffer.byteLength - 2))
  })

  t.end()
})

test('lexint: unpack', function (t) {
  let n
  let skip = 1

  for (n = 1; n < Number.MAX_VALUE; n += skip) {
    const cur = enc.encode(enc.lexint, n)
    compare(n, enc.decode(enc.lexint, cur))
    skip = 1 + Math.pow(245, Math.ceil(Math.log(n) / Math.log(256)))
  }
  t.is(n, Infinity)
  t.end()

  function compare (a, b) {
    const desc = a + ' !=~ ' + b
    if (/e\+\d+$/.test(a) || /e\+\d+$/.test(b)) {
      if (String(a).slice(0, 8) !== String(b).slice(0, 8) ||
        /e\+(\d+)$/.exec(a)[1] !== /e\+(\d+)$/.exec(b)[1]) {
        t.fail(desc)
      }
    } else {
      if (String(a).slice(0, 8) !== String(b).slice(0, 8) ||
       String(a).length !== String(b).length) {
        t.fail(desc)
      }
    }
  }
})

test('date', function (t) {
  const d = new Date()

  t.alike(enc.decode(enc.date, enc.encode(enc.date, d)), d)
})

test('any', function (t) {
  const o = {
    hello: 'world',
    num: 42,
    neg: -42,
    arr: [{ yes: 1 }, { no: false }],
    nest: {},
    today: new Date(),
    float: 0.54
  }

  t.alike(enc.decode(enc.any, enc.encode(enc.any, o)), o)

  const arr = new Array(3)

  t.alike(enc.decode(enc.any, enc.encode(enc.any, arr)), [null, null, null])
})

test('framed', function (t) {
  const e = enc.frame(enc.uint)
  t.alike(enc.encode(e, 42), b4a.from([0x01, 0x2a]))
  t.alike(enc.decode(e, b4a.from([0x01, 0x2a])), 42)
  t.alike(enc.encode(e, 4200), b4a.from([0x03, 0xfd, 0x68, 0x10]))
  t.alike(enc.decode(e, b4a.from([0x03, 0xfd, 0x68, 0x10])), 4200)
})
