// // code is poetry
import Holesail from './index.js'

// const server = new Holesail({ server: true, port: 4545, host: '127.0.0.1', secure: true, udp: true, key: 'asdads'})
// await server.ready()
// console.log(server.info)


const client = new Holesail({ client: true, secure: true, port: 3434, key: 'hs://s000ht187igtd7x91xiwrrpz9urrujm4p1bhxoqd9xjn47zdkebwdciy'})
await client.ready()
console.log(client.info)
setInterval(() => {
    console.log(client.info);
}, 5000);


