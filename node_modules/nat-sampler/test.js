const tape = require('tape')
const NatSampler = require('./')

tape('small consistent samples', function (t) {
  const nat = new NatSampler()

  t.same(nat.add('127.0.0.1', 9090), 1)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 9090)

  t.same(nat.add('127.0.0.1', 9090), 2)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 9090)

  t.same(nat.add('127.0.0.1', 9090), 3)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 9090)

  t.end()
})

tape('small consistent samples with errors', function (t) {
  const nat = new NatSampler()

  t.same(nat.add('127.0.0.1', 9090), 1)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 9090)

  t.same(nat.add('127.0.0.1', 9091), 1)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 0)

  t.same(nat.add('127.0.0.1', 9090), 2)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 0)

  t.same(nat.add('127.0.0.1', 9090), 3)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 9090)

  t.same(nat.add('127.0.0.1', 9091), 2)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 0)

  t.end()
})

tape('host consistency', function (t) {
  const nat = new NatSampler()

  t.same(nat.add('127.0.0.1', 9090), 1)
  t.same(nat.add('127.0.0.2', 9090), 1)
  t.same(nat.add('127.0.0.1', 9090), 2)
  t.same(nat.add('127.0.0.2', 9090), 2)

  t.same(nat.host, null)
  t.same(nat.port, 0)

  t.same(nat.add('127.0.0.1', 9090), 3)
  t.same(nat.host, null)
  t.same(nat.port, 0)

  t.same(nat.add('127.0.0.1', 9090), 4)
  t.same(nat.host, null)
  t.same(nat.port, 0)

  t.same(nat.add('127.0.0.1', 9090), 5)
  t.same(nat.host, null)
  t.same(nat.port, 0)

  t.same(nat.add('127.0.0.1', 9091), 1)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 0)

  t.end()
})

tape('can recover up to 3 errors', function (t) {
  const nat = new NatSampler()

  for (let i = 0; i < 20; i++) nat.add('127.0.0.1', 9090)

  t.same(nat.add('127.0.0.1', 9091), 1)
  t.same(nat.add('127.0.0.2', 9091), 1)
  t.same(nat.add('127.0.0.3', 9091), 1)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 9090)

  for (let i = 0; i < 5; i++) nat.add('127.0.0.1', 9090)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 9090)

  nat.add('127.0.0.1', 9095)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 0)

  nat.add('127.0.0.2', 9095)
  t.same(nat.host, '127.0.0.1')
  t.same(nat.port, 0)

  nat.add('127.0.0.2', 9095)
  t.same(nat.host, null)
  t.same(nat.port, 0)

  t.end()
})
