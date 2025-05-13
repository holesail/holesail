import HolesailServer from './index.js'

const server = new HolesailServer()

await server.start(
  {
    port: 9001,
    host: '0.0.0.0',
    udp: true,
    seed: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
    secure: true
  },
  async () => {
    const info = server.info
    console.log(`Reverse proxying ${info.protocol} server on ${info.host}:${info.port}`)
    console.log('Join with key: ', server.key)
    console.log(server.info)
  }
)
