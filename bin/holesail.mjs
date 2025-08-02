#!/usr/bin/env node
import { runtime } from 'which-runtime'
import process from 'process'
import minimist from 'minimist' // Required to parse CLI arguments
import goodbye from 'graceful-goodbye'
import Holesail from '../index.js'
import Livefiles from 'livefiles'
import printHelp from '../lib/help.js'
import { validateInput } from '../lib/validateInput.js'
import stdout from '../lib/stdout.js'
import { createRequire } from 'node:module'
import colors from 'barely-colours'

import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)

const require = createRequire(import.meta.url)
const { version } = require('../package.json')

const argv = minimist(process.argv.slice(2))

validateInput(argv)

let logOpt = false
if (argv.log !== undefined) {
  if (typeof argv.log === 'boolean' && argv.log) {
    logOpt = 1 // Default to INFO level if --log is provided without a value
  } else if (typeof argv.log === 'string') {
    const parsed = parseInt(argv.log, 10)
    logOpt = isNaN(parsed) ? 1 : Math.max(0, Math.min(3, parsed)) // Clamp between 0 (DEBUG) and 3 (ERROR)
  } else if (typeof argv.log === 'number') {
    logOpt = Math.max(0, Math.min(3, argv.log)) // Clamp between 0 (DEBUG) and 3 (ERROR)
  }
}

// Display help and exit
if (argv.help || argv.h) {
  printHelp(argv.help)
  process.exit(0)
}

// Display version and exit
if (argv.version) {
  console.log(version)
  process.exit(0)
}

// Set a port live
if (argv.live) {
  let secure
  if (argv.public !== undefined) {
    secure = !argv.public
  } else {
    secure = true
  }
  const conn = new Holesail({
    server: true,
    port: argv.live,
    host: argv.host || '127.0.0.1',
    udp: argv.udp,
    secure,
    key: argv.key,
    log: logOpt
  })
  await conn.ready()
  const info = conn.info
  stdout(info.protocol, info.type, info.secure, info.host, info.port, info.url)
} else if (argv.connect || argv._[0]) {
  const key = argv.connect || argv._[0]
  const conn = new Holesail({
    client: true,
    port: argv.port,
    host: argv.host,
    key,
    udp: argv.udp,
    secure: argv.public,
    log: logOpt
  })
  await conn.ready()
  const info = conn.info
  stdout(info.protocol, info.type, info.secure, info.host, info.port, info.url)
} else if (argv.filemanager) { // Start server with a filemanager
  const fileOptions = {
    path: argv.filemanager,
    role: argv.role,
    username: argv.username,
    password: argv.password,
    host: argv.host,
    port: argv.port
  }
  // Start files server
  const fileServer = new Livefiles(fileOptions)
  await fileServer.ready()
  const fsInfo = fileServer.info
  let secure
  if (argv.public !== undefined) {
    secure = !argv.public
  } else {
    secure = true
  }
  const connOptions = {
    server: true,
    port: argv.port || 5409,
    host: argv.host || '127.0.0.1',
    secure,
    key: argv.key,
    log: logOpt
  }
  const conn = new Holesail(connOptions)
  await conn.ready()
  const dhtInfo = conn.info
  stdout(dhtInfo.protocol, fsInfo.type, dhtInfo.secure, dhtInfo.host, dhtInfo.port, dhtInfo.url, {
    username: fsInfo.username,
    password: fsInfo.password,
    role: fsInfo.role
  })
  // destroy before exiting
  goodbye(async () => {
    await conn.close()
    await fileServer.close()
  })
} else if (argv.lookup) {
  try {
    const result = await Holesail.lookup(argv.lookup)
    if (result) {
      console.log(colors.cyan(colors.underline(colors.bold('Holesail Lookup Result'))) + ' 🔍')
      console.log(colors.magenta('Host: ') + colors.green(result.host || 'N/A'))
      console.log(colors.magenta('Port: ') + colors.green(result.port || 'N/A'))
      console.log(colors.magenta('Protocol: ') + colors.green(result.protocol || 'N/A'))
    } else {
      console.log(colors.red('No record found for the provided key.'))
    }
  } catch (error) {
    console.error(colors.red('Error during lookup:'), error.message)
  }
  process.exit(0)
} else { // Default if no correct option is chosen
  printHelp(argv.help)
  process.exit(0)
}
