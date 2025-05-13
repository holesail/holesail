import HolesailClient from './index.js'

const client = new HolesailClient({
  key: 'fwkkgncpatjpt5j6n53beqjoz7wtxtbse8d7u9z1y17esbz5dhpo', secure: true
})

await client.connect({ udp: false }, () => {
  const info = client.info
  console.log(`Running a ${info.protocol} client on ${info.host}:${info.port}`)
  console.log(info)
})
