import { command, flag, arg, summary, description, header, validate, rest } from 'paparam'
import goodbye from 'graceful-goodbye'
import Livefiles from 'livefiles'
import HolesailLogger from 'holesail-logger'
import Holesail from '../index.js'

const filemanager = command(
  'filemanager',
  summary('start a p2p filemanager server'),
  arg('<dir>', 'directory'),
  flag('--host|-h <host>', 'custom local address'),
  flag('--port|-p <port>', 'use a custom port'),
  flag('--log|-l <level>', 'log level'),
  flag('--seed|-s <seed>', 'custom seed to restart a connection'),
  flag('--user <username>', 'set a custom username'),
  flag('--pass <password>', 'set a custom password'),
  flag('--role|-r <admin|user>', 'set a user role'),
  async () => {
    const { dir } = filemanager.args
    const { host = '127.0.0.1', port, log, seed, user, pass, role } = filemanager.flags
    const logger = new HolesailLogger({ enabled: true, level: log })

    const livefileOpts = {
      path: dir,
      role,
      username: user,
      password: pass,
      host,
      port
    }

    const fileServer = new Livefiles(livefileOpts)
    await fileServer.ready()
    const fsInfo = fileServer.info

    const opts = {
      server: true,
      port,
      host,
      seed,
      logger
    }
    const conn = new Holesail(opts)
    await conn.ready()
    const info = conn.info
    logger.log({ type: 1, msg: `${JSON.stringify(fsInfo)} ${JSON.stringify(info)}` })

    goodbye(async () => {
      await conn.close()
      await fileServer.close()
    })
  }
)

export default filemanager
