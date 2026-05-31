// // code is poetry
import Holesail from './index.js'

const opts = {
  server: true,
  host: '127.0.0.1',
  port: 3456,
  seed: '66e877e724f2b976ccfce96cd31fb7ccede58239137f4591cb4ccf1c972cb8f8',
  udp: true,
  log
}

const server = new Holesail(opts)
await server.ready()

// unique
server.on('connection', (peer) => {
  // peer details
})

server.on('listening', (details) => {
  // server details here
})

server.on('close', () => {
  // dead
})

const opts = {
  server: true,
  host: '127.0.0.1',
  port: 3456,
  seed: '66e877e724f2b976ccfce96cd31fb7ccede58239137f4591cb4ccf1c972cb8f8',
  udp: true,
  log
}

const client = new Holesail(opts)
await client.ready()

client.on('connect', () => {
  //
})

client.on('listening', (details) => {
  // client details
})

client.on('close', () => {
  // dead
})

console.log(server.info)
