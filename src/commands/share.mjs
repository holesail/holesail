import { command, flag, arg, summary, description, header, validate, rest } from 'paparam'
import HolesailLogger from 'holesail-logger'
import Holesail from '../index.js'

const share = command(
  'share',
  summary('Share a port'),
  arg('<port>', 'local port'),
  flag('--host|-h <host>', 'custom local address'),
  flag('--udp|-u', 'use UDP protocol'),
  flag('--log|-l <level>', 'log level'),
  flag('--seed|-s <seed>', 'custom seed to restart a connection'),
  async () => {
    const { port } = share.args
    const { host = '127.0.0.1', udp, seed, log } = share.flags
    const logger = new HolesailLogger({ prefix: 'Holesail', level: log })

    const conn = new Holesail({
      server: true,
      port,
      host,
      udp,
      seed,
      logger
    })
    await conn.ready()
    const info = conn.info
    logger.info(info.key)
  }
)

export default share
