import test from 'brittle'
import HolesailServer from './index.js'
import z32 from 'z32'
import libKeys from 'hyper-cmd-lib-keys'

test('keyPairGenerator - should generate a deterministic key pair', async (t) => {
  const server = new HolesailServer()
  const seed = libKeys.randomBytes(32).toString('hex')
  const keyPair1 = server.generateKeyPair(seed)
  const keyPair2 = server.generateKeyPair(seed)

  t.alike(keyPair1.publicKey, keyPair2.publicKey, 'Public keys should be identical')
  t.alike(keyPair1.secretKey, keyPair2.secretKey, 'Secret keys should be identical')
  await server.destroy()
})

test('keyPairGenerator - should generate a new key pair if no seed provided', async (t) => {
  const server = new HolesailServer()
  const keyPair1 = server.generateKeyPair()
  const keyPair2 = server.generateKeyPair()

  t.unlike(keyPair1.publicKey, keyPair2.publicKey, 'Public keys should be different')
  t.unlike(keyPair1.secretKey, keyPair2.secretKey, 'Secret keys should be different')
  await server.destroy()
})

test('getPublicKey - should return correct key based on secure mode', async (t) => {
  const server = new HolesailServer()
  server.generateKeyPair()

  server.secure = false
  const pubKeyInsecure = server.key
  t.is(pubKeyInsecure, z32.encode(server.keyPair.publicKey), 'Public key should match')

  server.secure = true
  const pubKeySecure = server.key
  t.is(pubKeySecure, z32.encode(server.seed), 'Secure mode should return seed as hex')
  await server.destroy()
})

test('destroy - should clean up resources properly', async (t) => {
  const server = new HolesailServer()
  await server.destroy()
  t.is(server.dht, null, 'DHT instance should be null after destruction')
  t.is(server.server, null, 'Server instance should be null after destruction')
  t.is(server.state, 'destroyed', 'Server state should be destroyed')
})

test('start - should initialize and listen on generated key pair', async (t) => {
  const server = new HolesailServer()
  const args = { port: 8080, host: '127.0.0.1', secure: false, udp: false }

  // await new Promise((resolve) => server.start(args, resolve))
  await server.start(args)
  t.ok(server.server, 'Server should be initialized')
  t.ok(server.keyPair, 'Key pair should be generated')
  t.is(server.state, 'listening', 'Server state should be listening')
  await server.destroy()
})

test('resume - should resume the DHT instance', async (t) => {
  const server = new HolesailServer()
  await server.resume()
  t.is(server.state, 'listening', 'Server state should be listening after resume')
  await server.destroy()
})

test('pause - should suspend the DHT instance', async (t) => {
  const server = new HolesailServer()
  await server.pause()
  t.is(server.state, 'paused', 'Server state should be paused')
  await server.destroy()
})

test('info - should return correct server details', async (t) => {
  const server = new HolesailServer()
  const args = {
    port: 9090,
    host: '127.0.0.1',
    secure: true,
    udp: false,
    seed: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
  }

  await server.start(args, async () => {
    const info = server.info
    t.is(info.state, 'listening', 'State should be listening')
    t.is(info.secure, true, 'Secure mode should be true')
    t.is(info.port, 9090, 'Port should match')
    t.is(info.host, '127.0.0.1', 'Host should match')
    t.is(info.protocol, 'tcp', 'Protocol should be tcp')
    t.is(info.seed, args.seed, 'Seed should match')
    t.is(info.key, server.key, 'Public key should match')
  })

  await server.destroy()
})
