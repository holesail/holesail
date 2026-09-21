import { command, flag, arg, summary, description, header, validate, rest } from 'paparam'
import HolesailLogger from 'holesail-logger'
import Holesail from '../index.js'

const seed = command(
  'seed',
  summary('Generate a random seed'),
  flag('--log|-l <level>', 'log level'),
  async () => {
    const { log } = seed.flags
    const logger = new HolesailLogger({ prefix: 'Holesail', level: log })

    logger.info(Holesail.randomSeed())
  }
)

export default seed
