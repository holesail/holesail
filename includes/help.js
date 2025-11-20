const colors = require('colors/safe');

module.exports = {
  helpMessage: `
${colors.cyan.bold('Holesail - Instantly share and connect to servers')}

${colors.bold('Usage:')}
  ${colors.yellow('holesail [command] [options]')}

${colors.bold('Commands:')}
  ${colors.yellow('--help')}               Show this help message and exit.
  ${colors.yellow('--version')}            Show the current version and exit.
  ${colors.yellow('--live <port>')}        Start a Holesail server on <port>.
  ${colors.yellow('<connection string>')}  Connect to a Holesail server.
  ${colors.yellow('<args> --background')}  Run in the background.
  ${colors.yellow('--list')}               List all connections running in the background.
  ${colors.yellow('--delete <name>')}      Delete a background connection.
  ${colors.yellow('--stop <name>')}        Stop a background connection.
  ${colors.yellow('--start <name>')}       Start a stopped connection.
  ${colors.yellow('--logs <name>')}        View logs of a background task.

${colors.bold('Options:')}
  ${colors.yellow('--host <host>')}        Specify the host address (default: 127.0.0.1).
  ${colors.yellow('--udp')}                Use UDP instead of TCP.
  ${colors.yellow('--public')}             Start in public mode for sharing.
  ${colors.yellow('--port <port>')}        Use a custom port (default: 8989).
  ${colors.yellow('--filemanager')}        Start a filemanager session.
  ${colors.yellow('--username <name>')}    Set a username for filemanager (default: admin).
  ${colors.yellow('--password <pass>')}    Set a password for filemanager (default: admin).
  ${colors.yellow('--role <role>')}        Set a user role (admin or user).
  ${colors.yellow('--name <name>')}        Set a custom name for background task.

${colors.bold('Examples:')}
  ${colors.yellow('holesail --live 3000')}           Start a server on port 3000.
  ${colors.yellow('holesail --filemanager')}         Start filemanager in current directory.
  ${colors.yellow('holesail <connection string>')}   Connect to a server.

${colors.bold('Notes:')}
  Treat private connection strings like SSH keys. Public connection strings are shareable, but secure sensitive data with passwords or connectors.
`,

  printHelp: function (helpMessage) {
    console.log(helpMessage)
  }
}
