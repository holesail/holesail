import Livefiles from './index.js'

const filemanager = new Livefiles({
  path: './',
  role: 'admin',
  username: 'supersu',
  password: 'supersu',
  host: 'localhost',
  port: 6969
})

await filemanager.ready()
await filemanager.close()