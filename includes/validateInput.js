const colors = require('barely-colours')

module.exports = function ValidateInput (args) {
  // if (args.live && (args.connect || args._[0])) {
  //   console.log(colors.red("Error: You can't start a server and client at the same time. Kindly check and fix your inputs, see holesail --help"))
  //   process.exit(2)
  // }

  // 64 length string is considered a key not a connector
  if (args.connector && args.connector.length === 64) {
    console.log(colors.red('Error: --connector can not be of length 64, any string with length 64 is considered a public connection string internally, see holesail --help on how to use --connector'))
    process.exit(2)
  }

  // Restrict connector length to be at least 32 char long
  if (args.connector && args.connector.length < 32 && !args.force) {
    console.log(colors.red('Error: Custom connection strings should have a minimum length of 32 chars for security purposes. If you still wish to proceed use --force'))
    process.exit(2)
  }

  // Can't use two keys, can we?
  if (args.connect && args._[0]) {
    console.log(colors.red('Error: Lmao, are you trying to use two connection strings at once? Get some holesail --help mate'))
    process.exit(2)
  }

  // Throw error if specified connector is empty
  if (args.connector && typeof (args.connector) === 'boolean') {
    console.log(colors.red('Error: You have specified an empty connection string. Run holesail --help to see examples and how to use --connector'))
    process.exit(2)
  }

  // Port should be a number
  if (args.live && typeof (args.live) !== 'number') {
    console.log(colors.red('Error: Given port is not a valid number. Run holesail --help to see examples'))
    process.exit(2)
  }
  // Port should be a number
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

  // Connection can not be public and use connector at the same time
  if (args.public && args.connector) {
    console.log(colors.red('Error: --connector is not supported when the connection is public. Connection strings are generated randomly in public mode.'))
    process.exit(2)
  }

  //
  // Handle file manager
  //

  // Can't create a server and start filemanager at the same time
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
