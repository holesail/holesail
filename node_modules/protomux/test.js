const Protomux = require('./')
const SecretStream = require('@hyperswarm/secret-stream')
const test = require('brittle')
const c = require('compact-encoding')
const b4a = require('b4a')

test('basic', function (t) {
  const a = new Protomux(new SecretStream(true))
  const b = new Protomux(new SecretStream(false))

  replicate(a, b)

  const p = a.createChannel({
    protocol: 'foo',
    onopen () {
      t.pass('a remote opened')
    }
  })

  p.open()

  p.addMessage({
    encoding: c.string,
    onmessage (message) {
      t.is(message, 'hello world')
    }
  })

  const bp = b.createChannel({
    protocol: 'foo'
  })

  t.plan(2)

  bp.open()
  bp.addMessage({ encoding: c.string }).send('hello world')
})

test('echo message', function (t) {
  const a = new Protomux(new SecretStream(true))
  const b = new Protomux(new SecretStream(false))

  replicate(a, b)

  const ap = a.createChannel({
    protocol: 'foo'
  })

  ap.open()

  const aEcho = ap.addMessage({
    encoding: c.string,
    onmessage (message) {
      aEcho.send('echo: ' + message)
    }
  })

  b.createChannel({
    protocol: 'other'
  }).open()

  const bp = b.createChannel({
    protocol: 'foo',
    onopen () {
      t.pass('b remote opened')
    }
  })

  bp.open()

  const bEcho = bp.addMessage({
    encoding: c.string,
    onmessage (message) {
      t.is(message, 'echo: hello world')
    }
  })

  t.plan(2)

  bEcho.send('hello world')
})

test('multi message', function (t) {
  const a = new Protomux(new SecretStream(true))

  a.createChannel({
    protocol: 'other'
  }).open()

  const ap = a.createChannel({
    protocol: 'multi'
  })

  ap.open()

  const a1 = ap.addMessage({ encoding: c.int })
  const a2 = ap.addMessage({ encoding: c.string })
  const a3 = ap.addMessage({ encoding: c.string })

  const b = new Protomux(new SecretStream(false))

  const bp = b.createChannel({
    protocol: 'multi'
  })

  bp.open()

  const b1 = bp.addMessage({ encoding: c.int })
  const b2 = bp.addMessage({ encoding: c.string })

  replicate(a, b)

  t.plan(2)

  a1.send(42)
  a2.send('a string with 42')
  a3.send('should be ignored')

  const expected = [
    42,
    'a string with 42'
  ]

  b1.onmessage = function (message) {
    t.is(message, expected.shift())
  }

  b2.onmessage = function (message) {
    t.is(message, expected.shift())
  }
})

test('corks', function (t) {
  const a = new Protomux(new SecretStream(true))

  a.cork()

  a.createChannel({
    protocol: 'other'
  }).open()

  const ap = a.createChannel({
    protocol: 'multi'
  })

  ap.open()

  const a1 = ap.addMessage({ encoding: c.int })
  const a2 = ap.addMessage({ encoding: c.string })

  const b = new Protomux(new SecretStream(false))

  const bp = b.createChannel({
    protocol: 'multi'
  })

  bp.open()

  const b1 = bp.addMessage({ encoding: c.int })
  const b2 = bp.addMessage({ encoding: c.string })

  replicate(a, b)

  t.plan(4 + 1)

  const expected = [
    1,
    2,
    3,
    'a string'
  ]

  a1.send(1)
  a1.send(2)
  a1.send(3)
  a2.send('a string')

  a.uncork()

  b.stream.once('data', function (data) {
    t.ok(expected.length === 0, 'received all messages in one data packet')
  })

  b1.onmessage = function (message) {
    t.is(message, expected.shift())
  }

  b2.onmessage = function (message) {
    t.is(message, expected.shift())
  }
})

test('mega cork', function (t) {
  const a = new Protomux(new SecretStream(true))

  a.cork()

  const ap = a.createChannel({
    protocol: 'mega'
  })

  ap.open()

  const a1 = ap.addMessage({ encoding: c.buffer })

  const b = new Protomux(new SecretStream(false))

  const bp = b.createChannel({
    protocol: 'mega'
  })

  bp.open()

  const b1 = bp.addMessage({ encoding: c.buffer })

  replicate(a, b)

  t.plan(32 + 4)

  const buf = b4a.alloc(1024 * 1024)
  const expected = []

  for (let i = 0; i < 32; i++) {
    a1.send(buf)
    expected.push(buf)
  }

  a.uncork()

  b.stream.on('data', function (data) {
    t.ok(data.byteLength > 8000000, 'got big message')
  })

  b1.onmessage = function (message) {
    t.alike(message, expected.shift())
  }
})

test('handshake', function (t) {
  const a = new Protomux(new SecretStream(true))
  const b = new Protomux(new SecretStream(false))

  replicate(a, b)

  const p = a.createChannel({
    protocol: 'foo',
    handshake: c.string,
    onopen (handshake) {
      t.is(handshake, 'b handshake')
    }
  })

  p.open('a handshake')

  const bp = b.createChannel({
    protocol: 'foo',
    handshake: c.string,
    onopen (handshake) {
      t.is(handshake, 'a handshake')
    }
  })

  t.plan(2)

  bp.open('b handshake')
})

test('rejections', function (t) {
  t.plan(1)

  const a = new Protomux(new SecretStream(true))
  const b = new Protomux(new SecretStream(false))

  replicate(a, b)

  let closed = 0
  for (let i = 0; i < 10; i++) {
    const p = a.createChannel({
      protocol: 'foo#' + i,
      onclose () {
        closed++
        if (closed === 10) t.pass('all closed')
      }
    })

    p.open()
  }
})

test('pipeline close and rejections', function (t) {
  t.plan(1)

  const a = new Protomux(new SecretStream(true))
  const b = new Protomux(new SecretStream(false))

  replicate(a, b)

  let closed = 0
  for (let i = 0; i < 10; i++) {
    const p = a.createChannel({
      protocol: 'foo#' + i,
      onclose () {
        closed++
        if (closed === 10) {
          t.pass('all closed')
        }
      }
    })

    p.open()
    p.close()
  }
})

test('alias', function (t) {
  const a = new Protomux(new SecretStream(true))
  const b = new Protomux(new SecretStream(false))

  replicate(a, b)

  const p = a.createChannel({
    protocol: 'foo',
    aliases: ['bar'],
    onopen () {
      t.pass('a remote opened')
    }
  })

  p.open()

  p.addMessage({
    encoding: c.string,
    onmessage (message) {
      t.is(message, 'hello world')
    }
  })

  const bp = b.createChannel({
    protocol: 'bar'
  })

  t.plan(2)

  bp.open()
  bp.addMessage({ encoding: c.string }).send('hello world')
})

test('deduplicate muxers', function (t) {
  const sa = new SecretStream(true)
  const sb = new SecretStream(false)

  replicate({ stream: sa }, { stream: sb })

  const a = Protomux.from(sa)
  const foo = a.createChannel({
    protocol: 'foo',
    onopen () { t.pass('a remote opened') }
  })

  foo.open()

  foo.addMessage({
    encoding: c.string,
    onmessage (message) { t.is(message, 'hello foo') }
  })

  const bfoo = Protomux.from(sb).createChannel({ protocol: 'foo' })

  // Another Protomux instance for another protocol
  const a2 = Protomux.from(sa)
  const bar = a2.createChannel({
    protocol: 'bar',
    onopen () { t.pass('a remote opened') }
  })

  bar.open()

  bar.addMessage({
    encoding: c.string,
    onmessage (message) { t.is(message, 'hello bar') }
  })

  const bbar = Protomux.from(sb).createChannel({ protocol: 'bar' })

  t.plan(4)

  bfoo.open()
  bfoo.addMessage({ encoding: c.string }).send('hello foo')

  bbar.open()
  bbar.addMessage({ encoding: c.string }).send('hello bar')
})

test('open + send + close on same tick', async function (t) {
  t.plan(4)

  const a = new Protomux(new SecretStream(true))
  const b = new Protomux(new SecretStream(false))

  replicate(a, b)

  const ac = a.createChannel({
    protocol: 'foo',
    onopen () {
      t.pass('a opened')
    },
    onclose () {
      t.pass('a closed')
    }
  })

  ac.open()
  ac.addMessage({
    encoding: c.string,
    onmessage (message) { t.is(message, 'hello') }
  })

  const bc = b.createChannel({
    protocol: 'foo',
    onopen () {
      t.fail('b opened')
    },
    onclose () {
      t.pass('b closed')
    }
  })

  bc.open()
  bc.addMessage({ encoding: c.string }).send('hello')
  bc.close()
})

test('drain', function (t) {
  t.plan(7)

  const mux1 = new Protomux(new SecretStream(true))
  const mux2 = new Protomux(new SecretStream(false))

  t.ok(mux1.drained)
  t.ok(mux2.drained)

  replicate(mux1, mux2)

  const a = mux1.createChannel({
    protocol: 'foo',
    messages: [
      { encoding: c.string }
    ]
  })

  t.ok(a.drained)

  a.open()

  const b = mux2.createChannel({
    protocol: 'foo',
    messages: [
      { encoding: c.string }
    ],
    ondrain (c) {
      t.is(c, b)
      t.ok(mux1.drained)
    }
  })

  t.ok(b.drained)

  b.open()

  while (true) {
    const drained = b.messages[0].send('hello world')
    if (b.drained !== drained) t.fail('Drained property should be equal as in channel')
    if (mux2.drained !== drained) t.fail('Drained property should be equal as in mux')

    if (!drained) {
      t.pass()
      break
    }
  }
})

test('keep alive - one side only', function (t) {
  t.plan(1)

  const a = new Protomux(new SecretStream(true))
  const b = new Protomux(new SecretStream(false))

  a.stream.on('error', (err) => t.fail(err.message))
  b.stream.on('error', (err) => t.fail(err.message))

  a.stream.setKeepAlive(1)

  replicate(a, b)

  setTimeout(() => t.pass(), 500)
})

function replicate (a, b) {
  a.stream.rawStream.pipe(b.stream.rawStream).pipe(a.stream.rawStream)
}
