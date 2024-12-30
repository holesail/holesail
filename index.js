#!/usr/bin/env node
const { runtime } = require('which-runtime')
runtime === 'bare' && (process = require('bare-process'))
const argv = require('minimist')(process.argv.slice(2)) // Required to parse CLI arguments
const goodbye = require('graceful-goodbye')
const pkg = require('./package.json') // Holds info about the current package

const colors = require('colors/safe')

// Require all necessary files
const help = require('./includes/help.js')
const Client = require('./includes/client.js')
const Server = require('./includes/server.js')
const Filemanager = require('./includes/livefiles.js') // Adjust the path as needed
const { ValidateInput } = require('./includes/validateInput.js')
const { PM2logs } = require('barely-pm2')

// Validate every input and throw errors if incorrect input
const validator = new ValidateInput(argv)

// Setting up the command hierarchy
// Display help and exit
if (argv.help) {
  help.printHelp(help.helpMessage)
  process.exit(-1)
}

// Display version and exit
if (argv.version) {
  console.log(pkg.version)
  process.exit(-1)
}

if (argv.list || argv.delete || argv.stop || argv.start || argv.background || argv.logs) {
  if (runtime === 'bare') {
    console.log('Info: Running Holesail in background is not supported on bare')
    process.exit(1)
  }

  const { PM2list, PM2delete, PM2stop, PM2start, PM2create } = require('barely-pm2')
  if (argv.list) {
    PM2list()
    process.exit(1)
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

  if (argv.background) {
    let arr = ['list', 'delete', 'stop', 'start', 'background', 'name']
    arr.forEach(key => {
      delete argv[key]
    })

    let scriptArgs = Object.entries(argv).flatMap(([key, value]) => {
      return key === '_' ? value : [`--${key}`, value]
    })

    PM2create({ name: argv.name || `holesail-${Date.now()}`, script: './index.js', args: scriptArgs, timeout: '5000' })
  }

} else {

// Set a port live
  if (argv.live) {

    const options = {
      port: argv.live,
      host: argv.host,
      connector: argv.connector,
      public: argv.public,
      service: 'Server',
      udp: argv.udp
    }
    const server = new Server(options)
    server.start()
    goodbye(async () => {
      await server.destroy()
    })
  } else if (argv.connect || argv._[0]) { // Establish connection with a peer
    const keyInput = argv.connect || argv._[0]
    const options = {
      port: argv.port || 8989,
      host: argv.host || '127.0.0.1',
      connector: argv.connector,
      udp: argv.udp
    }
    const client = new Client(keyInput, options)
    client.start()
  } else if (argv.filemanager) { // Start server with a filemanager
    const options = {

      // options for the file manager
      path: argv.filemanager,
      username: argv.username,
      password: argv.password,
      role: argv.role,

      // options for holesail-server
      port: argv.port,
      connector: argv.connector,
      public: argv.public,
      service: 'Filemanager'
    }

    // Start files server
    const fileServer = new Filemanager(options)
    fileServer.start()
    // destroy before exiting
    goodbye(async () => {
      await fileServer.destroy()
    })
  } else { // Default if no correct option is chosen
    console.log(colors.red('Error: Invalid or Incorrect arguments specified. See holesail --help for a list of all valid arguments'))
    process.exit(2)
  }
}