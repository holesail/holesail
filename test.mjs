import test from 'brittle'
import Holesail from './index.js' // Adjust the import path as necessary

test('Holesail class initialization', function (t) {
  const instance = new Holesail({ mode: 'server', seed: 'test-seed' })

  t.is(instance.server, true, 'should be server mode')
  t.is(instance.seed, 'test-seed', 'should set seed correctly')
  t.is(instance.port, 8989, 'should have default port 8989')
  t.is(instance.host, '127.0.0.1', 'should have default host 127.0.0.1')
  t.is(instance.protocol, 'tcp', 'should default to tcp protocol')
})

test('Holesail class client mode', function (t) {
  const instance = new Holesail({ mode: 'client', key: 'test-key' })

  t.is(instance.server, false, 'should be client mode')
  t.is(instance.connector, 'test-key', 'should set connector key correctly')
})

test('Holesail class connection validation', async function (t) {
  await t.exception(async () => {
    new Holesail({ mode: 'client' }) // Missing key
  }, { message: 'Connection string not set for client' })

  await t.exception(async () => {
    new Holesail({ mode: 'server', protocol: 'invalid' }) // Invalid protocol
  }, { message: 'Incorrect protocol set' })
})

test('Holesail class server connection', async function (t) {
  const instance = new Holesail({ mode: 'server', seed: 'test-seed' })
  await instance._open()

  t.is(instance.dht.constructor.name, 'holesailServer', 'should initialize HolesailServer in server mode')

  await new Promise((resolve, reject) => {
    instance.connect((err) => {
      if (err) reject(err)
      else resolve()
    })
  })

  t.pass('should connect without error')
})

test('Holesail class client connection', async function (t) {
  const instance = new Holesail({ mode: 'client', key: 'test-key' })
  await instance._open()

  t.is(instance.dht.constructor.name, 'holesailClient', 'should initialize HolesailClient in client mode')

  await new Promise((resolve, reject) => {
    instance.connect((err) => {
      if (err) reject(err)
      else resolve()
    })
  })

  t.pass('should connect without error')
})

test('Holesail class connection error', async function (t) {
  const instance = new Holesail({ mode: 'server', seed: 'test-seed' })
  await instance._open()

  instance.running = true // Simulate already connected
  await t.exception(async () => {
    instance.connect(() => {})
  }, { message: 'Already connected' })
})

test('Holesail class info method', async function (t) {
  const instance = new Holesail({ mode: 'server', seed: 'test-seed' })
  await instance.ready()
  instance.connect()
  const info = instance.info
  t.is(info.server, true, 'info should indicate server mode')
  t.is(info.seed, 'test-seed', 'info should return correct seed')
  t.is(info.port, 8989, 'info should return correct port')
  instance.close()
})

test('Holesail class close method', async function (t) {
  const instance = new Holesail({ mode: 'server', seed: 'test-seed' })
  await instance._open()

  await instance._close()
  t.pass('should close without errors')
})
