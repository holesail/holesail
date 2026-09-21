import { command, flag, arg, summary, description, header, validate, rest } from 'paparam'
import HolesailLogger from 'holesail-logger'
import process from 'process'
import Holesail from '../index.js'
import banner from '../lib/banner.js'

const probe = command(
  'probe',
  header(banner),
  summary('lookup details of a connection'),
  arg('<invite>', 'invite to the remote peer'),
  flag('--log|-l <level>', 'log level'),
  async () => {
    const { invite } = probe.args
    const { log } = probe.flags
    const logger = new HolesailLogger({ prefix: 'Holesail', level: log })

    try {
      const data = await Holesail.probe(invite)
      if (data) {
        logger.info(data)
      } else {
        logger.error('No record found for the provided key.')
      }
    } catch (error) {
      logger.error(`Error while probing: ${error.message}`)
      process.exit(0)
    }
  }
)

export default probe
