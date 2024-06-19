const z32 = require('./')
const b4a = require('b4a')
const test = require('brittle')
const crypto = require('crypto')

test('basic examples', function (t) {
  {
    const s = z32.encode('Example z-base-32')
    const b = z32.decode(s)

    t.is(s, 'eihgn5mopt11y6tpcjozg3jpgc3y')
    t.is(b.toString(), 'Example z-base-32')
  }

  {
    const s = z32.encode('The quick brown fox jumps over the lazy dog. 👀')
    const b = z32.decode(s)

    t.is(s, 'ktwgkedtqiwsg43ycj3g675qrbug66bypj4s4hdurbzzc3m1rb4go3jyptozw6jyctzsqmty6nx3dyy')
    t.is(b.toString(), 'The quick brown fox jumps over the lazy dog. 👀')
  }
})

test('random buffers', function (t) {
  for (let i = 0; i < 1e5; i++) {
    const b = crypto.randomBytes(Math.round(Math.random() * 100))
    const s = z32.encode(b)
    const o = z32.decode(s)

    if (!b4a.equals(o, b)) {
      t.alike(o, b)
      return
    }
  }

  t.pass('all random buffers passed')
})

test('bad inputs', function (t) {
  t.exception(function () {
    z32.decode('!!!')
  })
  t.exception(function () {
    z32.decode('~~~')
  })
  t.exception(function () {
    z32.decode('I1I1I1')
  })
})
