import { command, flag, arg, summary, description, header, validate, rest } from 'paparam'
import HolesailLogger from 'holesail-logger'
import Holesail from '../index.js'

const lookup = command(
  'probe',
  summary('lookup details of a connection'),
  arg('<invite>', 'invite to the remote peer'),
  flag('--log|-l <level>', 'log level'),
  async () => {
    const { invite } = lookup.args
    const { log } = connect.flags
    const logger = new HolesailLogger({ prefix: 'Holesail', level: log })

    try {
      const data = await Holesail.probe(invite)
      if (data) {
        logger.info(data)
      } else {
        logger.error('No record found for the provided key.')
      }
    } catch (error) {
      logger.error(`Error during lookup: ${error.message}`)
    }
    // process.exit(0)
  }
)

export default lookup
