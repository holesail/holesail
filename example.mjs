// // code is poetry
import Holesail from './index.js'

const server = new Holesail({ server: true, port: 4545, udp: true, secure: true})
await server.ready()
console.log(server.info)

//
// const client = new Holesail({ client: true, port: 3434, key: server.info.url})
// await client.ready()
// console.log(client.info)
// setInterval(() => {
//     console.log(client.info);
// }, 5000);
//
//
