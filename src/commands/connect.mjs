import { command, flag, arg, summary, description, header, validate, rest } from 'paparam'
import HolesailLogger from 'holesail-logger'
import Holesail from '../index.js'

const connect = command(
  'connect',
  summary('Connect to a Holesail server'),
  arg('<invite>', 'invite to the remote peer'),
  flag('--host|-h <host>', 'custom local address'),
  flag('--udp|-u', 'use UDP protocol'),
  flag('--port|-p <port>', 'use custom port'),
  flag('--log|-l <level>', 'log level'),
  async () => {
    const { invite } = connect.args
    const { host, udp, port, log } = connect.flags
    const logger = new HolesailLogger({ prefix: 'Holesail', level: log })

    const conn = new Holesail({
      client: true,
      port,
      host,
      udp,
      invite,
      logger
    })
    await conn.ready()
    logger.info(conn.info)
  }
)

export default connect
