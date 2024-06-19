const safetyCatch = require('safety-catch')

module.exports = goodbye

const handlers = []

let exitCode = 0
let forceExit = false

goodbye.exiting = false
goodbye.exit = exit

const onsigint = onsignal.bind(null, 'SIGINT')
const onsigterm = onsignal.bind(null, 'SIGTERM')

function onsignal (name) {
  forceExit = forceExit || process.listenerCount(name) === 1
  process.removeListener('SIGINT', onsigint)
  process.removeListener('SIGTERM', onsigterm)
  exitCode = 130
  onexit()
}

function onexit () {
  if (goodbye.exiting) return
  goodbye.exiting = true

  process.removeListener('beforeExit', onexit)

  const order = []

  for (const h of handlers.sort((a, b) => b.position - a.position)) {
    if (!order.length || order[order.length - 1][0].position !== h.position) order.push([])
    order[order.length - 1].push(h)
  }

  loop()

  function loop () {
    if (!order.length) return done()
    Promise.allSettled(order.pop().map(run)).then(loop, loop)
  }

  function done () {
    if (forceExit) process.exit(exitCode)
  }
}

async function run (h) {
  try {
    await h.fn()
  } catch (e) {
    safetyCatch(e)
  }
}

function setup () {
  process.prependListener('beforeExit', onexit)
  process.prependListener('SIGINT', onsigint)
  process.prependListener('SIGTERM', onsigterm)
}

function cleanup () {
  process.removeListener('beforeExit', onexit)
  process.removeListener('SIGINT', onsigint)
  process.removeListener('SIGTERM', onsigterm)
}

function goodbye (fn, position = 0) {
  if (handlers.length === 0) setup()
  const handler = { position, fn }
  handlers.push(handler)

  return function unregister () {
    const i = handlers.indexOf(handler)
    if (i > -1) handlers.splice(i, 1)
    if (!handlers.length) cleanup()
  }
}

function exit () {
  forceExit = true
  process.removeListener('SIGINT', onsigint)
  process.removeListener('SIGTERM', onsigterm)
  onexit()
}
