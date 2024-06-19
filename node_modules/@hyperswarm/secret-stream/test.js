const test = require('brittle')
const net = require('net')
const Events = require('events')
const crypto = require('crypto')
const { Readable, Duplex } = require('streamx')
const NoiseStream = require('./')

test('basic', function (t) {
  t.plan(2)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  a.on('open', function () {
    t.alike(a.remotePublicKey, b.publicKey)
  })

  b.on('open', function () {
    t.alike(a.publicKey, b.remotePublicKey)
  })
})

test('data looks encrypted', function (t) {
  t.plan(2)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  a.write(Buffer.from('plaintext'))

  const buf = []

  a.rawStream.on('data', function (data) {
    buf.push(Buffer.from(data))
  })

  b.on('data', function (data) {
    t.alike(data, Buffer.from('plaintext'))
    t.ok(Buffer.concat(buf).indexOf(Buffer.from('plaintext')) === -1)
  })
})

test('works with external streams', function (t) {
  t.plan(2)

  const server = net.createServer(function (socket) {
    const s = new NoiseStream(false, socket)

    s.on('data', function (data) {
      s.destroy()
      t.alike(data, Buffer.from('encrypted!'))
    })
  })

  server.listen(0, function () {
    const socket = net.connect(server.address().port)
    const s = new NoiseStream(true, socket)

    s.write(Buffer.from('encrypted!'))
    s.on('close', function () {
      server.close()
    })
  })

  server.on('close', function () {
    t.pass()
  })
})

test('works with tiny chunks', function (t) {
  t.plan(2)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  const tmp = crypto.randomBytes(40000)

  a.write(Buffer.from('hello world'))
  a.write(tmp)

  a.rawStream.on('data', function (data) {
    for (let i = 0; i < data.byteLength; i++) {
      b.rawStream.write(data.subarray(i, i + 1))
    }
  })

  b.rawStream.on('data', function (data) {
    for (let i = 0; i < data.byteLength; i++) {
      a.rawStream.write(data.subarray(i, i + 1))
    }
  })

  b.once('data', function (data) {
    t.alike(data, Buffer.from('hello world'))
    b.once('data', function (data) {
      t.alike(data, tmp)
    })
  })
})

test('async creation', function (t) {
  t.plan(3)

  const server = net.createServer(function (socket) {
    const s = new NoiseStream(false, socket)

    s.on('data', function (data) {
      s.destroy()
      t.alike(data, Buffer.from('encrypted!'))
    })
  })

  server.listen(0, function () {
    const s = new NoiseStream(true, null, {
      autoStart: false
    })

    t.absent(s.rawStream, 'not started')

    const socket = net.connect(server.address().port)
    socket.on('connect', function () {
      s.start(socket)
    })

    s.write(Buffer.from('encrypted!'))
    s.on('close', function () {
      server.close()
    })
  })

  server.on('close', function () {
    t.pass()
  })
})

test('send and recv lots of data', function (t) {
  t.plan(3)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  const buf = crypto.randomBytes(65536)
  let size = 1024 * 1024 * 1024 // 1gb

  const r = new Readable({
    read (cb) {
      this.push(buf)
      size -= buf.byteLength
      if (size <= 0) this.push(null)
      cb(null)
    }
  })

  r.pipe(a)

  const then = Date.now()
  let recv = 0
  let same = true

  b.on('data', function (data) {
    if (same) same = data.equals(buf)
    recv += data.byteLength
  })
  b.on('end', function () {
    t.is(recv, 1024 * 1024 * 1024)
    t.ok(same, 'data was the same')
    t.pass('1gb transfer took ' + (Date.now() - then) + 'ms')
  })
})

test('send garbage handshake data', function (t) {
  t.plan(2)

  check(Buffer.alloc(65536))
  check(Buffer.from('\x10\x00\x00garbagegarbagegarbage'))

  function check (buf) {
    const a = new NoiseStream(true)

    a.on('error', function () {
      t.pass('handshake errored')
    })

    a.rawStream.write(buf)
  }
})

test('send garbage secretstream header data', function (t) {
  t.plan(2)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  b.on('error', () => {})

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  a.on('error', function () {
    t.pass('header errored')
  })

  a.on('open', function () {
    t.pass('opened')
    a.rawStream.write(Buffer.from([0xff, 0, 0]))
    a.rawStream.write(crypto.randomBytes(0xff))
  })
})

test('send garbage secretstream payload data', function (t) {
  t.plan(2)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  b.on('error', () => {})
  b.write(Buffer.from('hi'))

  b.on('data', function (data) {
    t.fail('b should not recv messages')
  })

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  a.on('error', function () {
    t.pass('payload errored')
  })

  a.once('data', function () {
    t.pass('a got initial message')
    a.rawStream.write(Buffer.from([0xff, 0, 0]))
    a.rawStream.write(crypto.randomBytes(0xff))
  })
})

test('handshake outside', async function (t) {
  t.plan(1)

  const hs = await createHandshake()

  const a = new NoiseStream(true, null, {
    handshake: hs[0]
  })

  const b = new NoiseStream(false, null, {
    handshake: hs[1]
  })

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  a.write('test')

  const [data] = await Events.once(b, 'data')
  t.alike(data, Buffer.from('test'))
})

test('pass in head buffer', async function (t) {
  t.plan(3)

  const hs = await createHandshake()

  const a = new NoiseStream(true, null, {
    handshake: hs[0]
  })

  const b = new NoiseStream(false, null, {
    autoStart: false
  })

  a.write('test1')
  a.write('test2')

  const expected = [Buffer.from('test1'), Buffer.from('test2'), Buffer.from('test3')]

  let done
  const promise = new Promise((resolve) => { done = resolve })

  b.on('data', function (data) {
    t.alike(data, expected.shift())
    if (expected.length === 0) done()
  })

  const buf = []
  a.rawStream.on('data', function ondata (head) {
    buf.push(head)
    if (buf.length === 2) {
      a.rawStream.removeListener('data', ondata)

      b.start(null, {
        handshake: hs[1],
        data: Buffer.concat(buf)
      })

      a.rawStream.pipe(b.rawStream).pipe(a.rawStream)
      a.write('test3')
    }
  })

  return promise
})

test('errors are forwarded', async function (t) {
  t.plan(4)

  let same

  const promise = new Promise((resolve) => {
    let plan = 4

    same = (a, b, m) => {
      t.alike(a, b, m)
      if (--plan <= 0) resolve()
    }
  })

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  await new Promise((resolve) => a.on('handshake', resolve))

  const error = new Error('hello')

  a.destroy(error)
  b.destroy(error)

  a.rawStream.on('error', (err) => same(err, error))
  b.rawStream.on('error', (err) => same(err, error))

  a.on('error', (err) => same(err, error))
  b.on('error', (err) => same(err, error))

  return promise
})

test('can destroy in the first tick', function (t) {
  t.plan(1)

  const stream = new Duplex()
  const a = new NoiseStream(true, stream)

  a.on('error', function (err) {
    t.alike(err, new Error('stop'))
  })

  // hackish destroy to force it in the first tick
  stream.emit('error', new Error('stop'))
})

test('keypair can be a promise', function (t) {
  t.plan(2)

  const kp = NoiseStream.keyPair()

  const a = new NoiseStream(true, null, {
    keyPair: new Promise((resolve) => {
      setImmediate(() => resolve(kp))
    })
  })

  const b = new NoiseStream(false)

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  a.on('connect', function () {
    t.alike(kp.publicKey, a.publicKey)
  })

  b.on('connect', function () {
    t.alike(kp.publicKey, b.remotePublicKey)
  })
})

test('keypair can be a promise that rejects', function (t) {
  t.plan(4)

  const a = new NoiseStream(true, null, {
    keyPair: new Promise((resolve, reject) => {
      reject(new Error('stop'))
    })
  })

  const b = new NoiseStream(false)

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  a.rawStream.on('error', function (err) {
    t.alike(err, new Error('stop'))
  })

  a.on('error', function (err) {
    t.alike(err, new Error('stop'))
  })

  b.rawStream.on('error', function (err) {
    t.alike(err, new Error('stop'))
  })

  b.on('error', function (err) {
    t.alike(err, new Error('stop'))
  })
})

test('drains data after both streams end', function (t) {
  t.plan(1)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  b.end()
  a.end(Buffer.from('hello world'))

  b.once('data', function (data) {
    t.alike(data, Buffer.from('hello world'))
  })
})

test('can timeout', function (t) {
  t.plan(1)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  let i = 0

  a.setTimeout(200)
  a.resume()
  a.on('error', function () {
    clearTimeout(interval)
    t.ok(i >= 10)
  })

  b.on('error', () => {})
  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  const interval = setInterval(tick, 50)

  function tick () {
    i++
    if (i < 10) b.write('hi')
  }
})

test('keep alive', function (t) {
  t.plan(2)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  let i = 0

  a.setKeepAlive(500)
  b.setKeepAlive(500)
  t.is(a.keepAlive, 500)

  a.resume()

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)
  b.rawStream.on('data', function (data) {
    if (data.byteLength === 20) { // empty message
      clearInterval(interval)
      t.ok(i > 10, 'keep alive when idle')
      a.end()
      b.end()
    }
  })

  const interval = setInterval(tick, 100)

  function tick () {
    i++
    if (i < 10) {
      b.write('hi')
    }
  }
})

test('message is too large', function (t) {
  t.plan(2)

  const a = new NoiseStream(true)
  const b = new NoiseStream(false)

  a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

  a.on('error', () => t.pass('should error'))
  b.on('error', () => t.pass('should error'))

  a.write(Buffer.alloc(32 * 1024 * 1024))
})

function createHandshake () {
  return new Promise((resolve, reject) => {
    const a = new NoiseStream(true)
    const b = new NoiseStream(false)

    let missing = 2

    a.on('handshake', onhandshake)
    b.on('handshake', onhandshake)

    a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

    function onhandshake () {
      if (--missing === 0) {
        a.destroy()
        b.destroy()
        resolve([{
          publicKey: a.publicKey,
          remotePublicKey: a.remotePublicKey,
          hash: a.handshakeHash,
          tx: a._encrypt.key,
          rx: a._decrypt.key
        }, {
          publicKey: b.publicKey,
          remotePublicKey: b.remotePublicKey,
          hash: b.handshakeHash,
          tx: b._encrypt.key,
          rx: b._decrypt.key
        }])
      }
    }
  })
}
