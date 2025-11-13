const colors = require('barely-colours')

function validateInput (args) {
  if (args.key && typeof args.key === 'boolean') {
    console.log(colors.red('Error: Key can not be empty'))
    process.exit()
  }

  //  restrict the use of localhost or 0.0.0.0 when udp is true
  if (args.udp && (args.host === 'localhost' || args.host === '0.0.0.0')) {
    console.log(colors.red('Error: You can’t use localhost or 0.0.0.0 as an address when using UDP'))
    process.exit(2)
  }

  // Restrict key length to be at least 32 char long
  if (args.key && args.key.length < 32 && !args.force) {
    console.log(colors.red('Error: A key should have a minimum length of 32 chars for security purposes. If you still wish to proceed use --force'))
    process.exit(2)
  }

  // Can't use two keys, can we?
  if (args.connect && args._[0]) {
    console.log(colors.red('Error: Are you trying to use two connection strings at once? Get some holesail --help'))
    process.exit(2)
  }

  // Port should be a number
  if (args.live && typeof (args.live) !== 'number') {
    console.log(colors.red('Error: Given port is not a valid number. Run holesail --help to see examples'))
    process.exit(2)
  }

  // This if else because empty strings are falsy values, can also be replaced with args.hasOwnProperty("port")
  if (args.port) {
    if (typeof (args.port) !== 'number') {
      console.log(colors.red('Error: Given port is not a valid number. Run holesail --help to see examples'))
      process.exit(2)
    }
  } else if (args.port === '') {
    console.log(colors.red('Error: Given port is not a valid number. Run holesail --help to see examples'))
    process.exit(2)
  }

  //
  // Handle file manager
  //

  // Can't create a server and start filemanager at the same time
  if (args.filemanager && args.udp) {
    console.log(colors.red('Error: You can\'t run filemanager in UDP mode.'))
    process.exit(2)
  }

  if (args.live && args.filemanager) {
    console.log(colors.red('Error: You can\'t start holesail server and filemanager at the same time. If you are trying to use filemanager on a specific local port use --port instead or see holesail --help'))
    process.exit(2)
  }

  // Can't create a connection and start filemanager at the same time
  if (args.filemanager && (args.connect || args._[0])) {
    console.log(colors.red('Error: You tried to create a connection and start filemanager both at once. Start them separately and check your command for mistakes. See holesail --help'))
    process.exit(2)
  }

  // Verify the given path is correct
  if (args.filemanager && typeof (args.filemanager) !== 'boolean') {
    // check if the given path is correct
    const fs = require('fs')
    if (!fs.existsSync(args.filemanager)) {
      console.log(colors.red('Error: Given path does not exist'))
      process.exit(2)
    }
  }

  // Set correct roles only
  if (args.role && ((args.role !== 'admin') && (args.role !== 'user'))) {
    console.log(colors.red('Error: Incorrect role set. Role can be either "admin" or "user" '))
    process.exit(2)
  }
}

function validateOpts (opts) {
  if ((opts.client && !opts.key) || opts.key === '') {
    throw new Error('Key is empty')
  }

  if (opts.protocol !== undefined && (opts.protocol !== 'udp' && opts.protocol !== 'tcp')) {
    throw new Error('Incorrect protocol set')
  }

  if (opts.server && opts.client) {
    throw new Error('Can not set both server and client at once')
  }

  if (opts.server && opts.seed === '') {
    throw new Error('Seed is empty')
  }

  if (opts.server && !opts.host) {
    throw new Error('No host specified')
  }
}

module.exports = {
  validateInput,
  validateOpts
}
