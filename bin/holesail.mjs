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

import { fileURLToPath } from 'url'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const require = createRequire(import.meta.url)
const { version } = require('../package.json')
const argv = minimist(process.argv.slice(2))

validateInput(argv)

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

// -------------------------------------
// Removed argv.background
// -------------------------------------
if (argv.list || argv.delete || argv.stop || argv.start || argv.logs) {
  if (runtime === 'bare') {
    console.log('Info: Running Holesail in background is not supported on bare')
    process.exit(0)
  }

  const { PM2list, PM2delete, PM2stop, PM2start, PM2create, PM2logs } = await import('barely-pm2')
  if (argv.list) {
    PM2list({ raw: true, name: 'holesail' })
  }

  if (argv.delete) {
    PM2delete(argv.delete)
  }

  if (argv.stop) {
    PM2stop(argv.stop)
  }

  if (argv.start) {
    PM2start(argv.start)
  }

  if (argv.logs) {
    PM2logs(argv.logs)
  }

  // ------------------------------------
  // Commented argv.background condition
  // ------------------------------------
  // if (argv.background) {
  //   const arr = ['list', 'delete', 'stop', 'start', 'background']
  //   arr.forEach(key => {
  //     delete argv[key]
  //   })

  //   const scriptArgs = Object.entries(argv).flatMap(([key, value]) => {
  //     return key === '_' ? value : [`--${key}`, value]
  //   })

  //   const name = argv.name ? 'holesail-' + argv.name : `holesail-${Date.now()}`

  //   PM2create({
  //     name,
  //     script: __filename,
  //     args: scriptArgs,
  //     timeout: '5000'
  //   })
  // }
} else {
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
      key: argv.key
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
      secure: argv.public
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
      key: argv.key
    }
    const conn = new Holesail(connOptions)
    await conn.ready()

    const dhtInfo = conn.info
    stdout(dhtInfo.protocol, fsInfo.type, dhtInfo.secure, dhtInfo.host, dhtInfo.port, dhtInfo.url, { username: fsInfo.username, password: fsInfo.password, role: fsInfo.role })

    // destroy before exiting
    goodbye(async () => {
      await conn.close()
      await fileServer.close()
    })
  } else { // Default if no correct option is chosen
    printHelp(argv.help)
    process.exit(0)
  }
}

// Removed the line from help.js
// ${colors.yellow('--background')}            Run in the background.
