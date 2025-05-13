const Noise = require('noise-handshake')
const test = require('tape')
const curve = require('./')

test('XX', t => {
  const initiator = new Noise('XX', true, null, { curve })
  const responder = new Noise('XX', false, null, { curve })

  initiator.initialise(Buffer.alloc(0))
  responder.initialise(Buffer.alloc(0))

  const message = initiator.send()
  responder.recv(message)

  const reply = responder.send()
  initiator.recv(reply)

  t.deepEqual(initiator.rx, responder.tx)
  t.deepEqual(initiator.tx, responder.rx)
  t.end()
})
