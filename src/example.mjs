// // code is poetry
import Holesail from './index.js'

// Capture every event an instance emits by wrapping its emit()
const eventCounts = new Map() // label -> Map(event -> count)
function captureEvents(label, instance) {
  const counts = new Map()
  eventCounts.set(label, counts)
  const originalEmit = instance.emit.bind(instance)
  instance.emit = (event, ...args) => {
    const count = (counts.get(event) || 0) + 1
    counts.set(event, count)
    console.log(
      `[${label}] emit "${String(event)}" (#${count})${count > 1 ? '  <-- DUPLICATE' : ''}`
    )
    return originalEmit(event, ...args)
  }
}

process.on('exit', () => {
  console.log('\n===== EVENT SUMMARY =====')
  for (const [label, counts] of eventCounts) {
    console.log(`\n${label}:`)
    if (counts.size === 0) console.log('  (no events emitted)')
    for (const [event, count] of counts) {
      console.log(`  ${String(event)}: ${count}${count > 1 ? '  <-- DUPLICATE' : ''}`)
    }
  }
})

const serverOpts = {
  server: true,
  host: '127.0.0.1',
  port: 3456,
  seed: '66e877e724f2b976ccfce96cd31fb7ccede58239137f4591cb4ccf1c972cb8f8'
}

// hs_yf8xtcpyffw3zzhj1k4hgbt98gi97bdagf8w7rnp7smzh34sptuiwawfrrbo5famjfnrhkbc6f331y6q8wkzn8truogq6ej9rressmqg5nzzw1y
const server = new Holesail(serverOpts)
captureEvents('server', server)
await server.ready()
const invite = server.info.invite
console.log(server.info)

setTimeout(async () => {
  await server.close()
}, 5000)

// // unique
// server.on('connection', (peer) => {
//   // peer details
//   console.log('conn')
// })

// server.on('listening', (details) => {
//   // server details here
//   console.log('listening')
// })

// server.on('close', () => {
//   // dead
//   console.log('close')
// })

const opts = {
  server: false,
  host: '127.0.0.1',
  port: 3457,
  invite,
  udp: false
}

const client = new Holesail(opts)
captureEvents('client', client)
await client.ready()

setTimeout(async () => {
  await client.close()
}, 8000) // 8000 milliseconds = 8 seconds

// client.on('connect', () => {
//   //
// })

// client.on('listening', (details) => {
//   // client details
// })

// client.on('close', () => {
//   // dead
// })

// console.log(server.info)
