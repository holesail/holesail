const colors = require('barely-colours')

function printHelp (opts) {
  const header = `${colors.cyan('Holesail CLI - Instantly share and connect to servers')}`
  let message = `

${colors.bold('Usage:')}
  ${colors.yellow('holesail [command] [options]')}

${colors.bold('Commands:')}
  ${colors.yellow('--help <command>|-h')}     Display help information.
  ${colors.yellow('--version|-v')}            Display version information.
  ${colors.yellow('--live <port>')}           Start a Holesail server on <port>.
  ${colors.yellow('--connect <key>')}         Connect to a Holesail server.
  ${colors.yellow('--background')}            Run in the background.
  ${colors.yellow('--filemanager')}           Start a filemanager session.  
  ${colors.yellow('--list')}                  List all connections running in the background.
  ${colors.yellow('--delete <name>')}         Delete a background connection.
  ${colors.yellow('--stop <name>')}           Stop a background connection.
  ${colors.yellow('--start <name>')}          Start a stopped connection.
  ${colors.yellow('--logs <name>')}           View logs of a background task.

${colors.bold('Options:')}
  ${colors.yellow('--host <host>')}           Specify the host address (default: 127.0.0.1).
  ${colors.yellow('--udp')}                   Use UDP instead of TCP.
  ${colors.yellow('--public')}                Start in public mode for sharing.
  ${colors.yellow('--port <port>')}           Use a custom port (default: 8989).

${colors.bold('Examples:')}
  ${colors.yellow('holesail --live 3000')}      Start a server on port 3000.
  ${colors.yellow('holesail --filemanager .')}  Start filemanager in current directory.
  ${colors.yellow('holesail <key>')}            Connect to a server.

${colors.bold('Notes:')}
  Treat private keys like SSH keys. Public keys are shareable, but secure sensitive data with passwords or connectors.
`

  if (opts && opts === 'live') {
    message = `
  ${colors.cyan('\nReverse proxy a specific port')}    
  ${colors.bold('Usage:')}
  ${colors.yellow('holesail --live <port> [options]')}
  ${colors.bold('Options:')}
  ${colors.yellow('--host <address>')}   Use a custom host.
  ${colors.yellow('--udp')}              Use UDP protocol.
  ${colors.yellow('--public')}           Uses a different key to connect than the one used to start the server.
  ${colors.yellow('--key <key>')}        Set a custom key.
    `
  }

  if (opts && opts === 'background') {
    message = `
  ${colors.cyan('\nRun in background')}    
  ${colors.bold('Usage:')}
  ${colors.yellow('holesail <args> --background [options]')}
  ${colors.bold('Options:')}
  ${colors.yellow('--name <name>')}      Use a custom name.
    `
  }

  if (opts && opts === 'connect') {
    message = `
  ${colors.cyan('\nConnect to a Holesail server')}    
  ${colors.bold('Usage:')}
  ${colors.yellow('holesail --connect <key> [options]')}
  ${colors.yellow('holesail <key> [options]')}
  
  ${colors.bold('Options:')}
  ${colors.yellow('--host <address>')}   Use a custom host.
  ${colors.yellow('--udp')}              Use UDP protocol.
  ${colors.yellow('--port <port>')}      Use a custom port.
  ${colors.yellow('--public')}           Force the connection to use public mode (otherwise autodetected).
    `
  }

  if (opts && opts === 'filemanager') {
    message = `
  ${colors.cyan('\nStart a file server at given location.')}    
  ${colors.bold('Usage:')}
  ${colors.yellow('holesail --filemanager <dir> [options]')}
  
  ${colors.bold('Options:')}
  ${colors.yellow('--host <host>')}      Use a custom host.
  ${colors.yellow('--port <port>')}      Use a custom port.
  ${colors.yellow('--public')}           Force the connection to use public mode (otherwise autodetected).
  ${colors.yellow('--username <user>')}  Set a custom username (Default: admin).
  ${colors.yellow('--password <pass>')}  Set a custom password (Default: admin).
  ${colors.yellow('--role <admin|user>')}Set a user role.
    `
  }

  const help = header + message
  console.log(help)
}

module.exports = printHelp
