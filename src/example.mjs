// // code is poetry
import Holesail from './index.js'

const server = new Holesail({ server: true, port: 4545, secure: true, host: '127.0.0.1' })
await server.ready()
console.log(server.info)
