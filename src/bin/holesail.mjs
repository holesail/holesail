import { command, flag, arg, summary, description, header, validate, rest } from 'paparam'
import banner from '../lib/banner.js'

import connect from '../commands/connect.mjs'
import share from '../commands/share.mjs'
import probe from '../commands/lookup.mjs'
import filemanager from '../commands/filemanager.mjs'
import seed from '../commands/seed.mjs'

const cmd = command(
  'holesail',
  summary('Share local services over peer to peer tunnels'),
  header(banner),
  share,
  connect,
  probe,
  seed,
  filemanager,
  () => console.log(cmd.help())
)

cmd.parse()
