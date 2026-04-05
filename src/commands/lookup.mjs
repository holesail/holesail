import { command, flag, arg, summary, description, header, validate, rest } from 'paparam'
import HolesailLogger from 'holesail-logger'
import Holesail from '../index.js'

const lookup = command(
  'lookup',
  summary('lookup details of a connection'),
  arg('<key>', 'connection key'),
  async () => {
    const { key } = lookup.args
    const logger = new HolesailLogger({ enabled: true, level: 0 })

    try {
      const data = await Holesail.lookup(key)
      if (data) {
        logger.log({ type: 1, msg: JSON.stringify(data) })
      } else {
        logger.log({ type: 1, msg: 'No record found for the provided key.' })
      }
    } catch (error) {
      logger.log({ type: 1, msg: `Error during lookup: ${error.message}` })
    }
    // process.exit(0)
  }
)

export default lookup
