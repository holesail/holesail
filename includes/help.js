const colors = require('colors/safe')

module.exports = {
  helpMessage: `
${colors.cyan.bold('Now manage and run holesail connections in background with holesail-manager')}
    
${colors.cyan.bold('Holesail Help')}

${colors.bold('Description:')}
${colors.white('Instantly share any server running on a specific port with Holesail.')}

${colors.yellow('- --help')}
${colors.white('  Displays this help message and exits.')}

${colors.yellow('- --version')}
${colors.white('  Displays the version of the Holesail package and exits.')}


${colors.bold('Quick Usage:')}

${colors.yellow('- Start a Holesail server:')}
${colors.white('  holesail --live <port> --host <host> ')}

${colors.yellow('- Start a Holesail server in public mode:')}
${colors.white('  holesail --live <port> --host <host> --public')}

${colors.yellow('- Connect to a Holesail server:')}
${colors.white('  holesail  <connection string>')}

${colors.yellow('- Start a Filemanager session in the current directory:')}
${colors.white('  holesail --filemanager')}

${colors.bold('Options:')}

${colors.yellow('- --port <port>')}
${colors.white('  Specify a custom port for the client and filemanager to listen on.\n  Default: 8989. Filemanager: 5409.')}

${colors.yellow('- --host <host>')}
${colors.white('  Specifies the host address for the server or client connection.\n  Default: 127.0.0.1.')}

${colors.yellow('- --public <port>')}
${colors.white('  Starts a Holesail server or Filemanager with Public connection string. The generated connection string can be shared with third parties. Default is private connection string')}

${colors.yellow('- --force')}
${colors.white('  Bypass custom connection string length limit')}

${colors.bold('Holesail Server (Share your ports with Peers):')}

${colors.yellow('- --live <port>')}
${colors.white('  Set a port <port> live. This will generate a connection string')}

${colors.yellow('- --connector <connection-string>')}
${colors.white('  Set a custom connection string for the server. Connection string length should be at least 32 chars for security reasons. Custom connection string can not be of exactly 64 chars.')}  

${colors.bold('Holesail Client (Connect to a Peer):')}

${colors.yellow('- Connect to a Holesail server:')}
${colors.white('  holesail  <connection string>')}

${colors.yellow('- --connect <connection string>')}
${colors.white('  Connect to a holesail connection string same as doing holesail <connection string>.')}

${colors.bold('Filemanager:')}

${colors.yellow('- --filemanager <path>')}
${colors.white(' Start a filemanager session in the specified directory with default username and password. Default username is "admin" and default password is "admin" ')}

${colors.yellow('- --username')}
${colors.white(' Set a custom username for filemanager access. \n Default: admin')}

${colors.yellow('- --password')}
${colors.white(' Set a custom password for filemanager access.\n Default: admin')}

${colors.yellow('- --role')}
${colors.white(' Change role for users. Available roles are "admin" and "user" \n Default: user')}

${colors.bold('Examples:')}

${colors.yellow('- Start a Holesail server on port 3000 with default host and private mode:')}
${colors.white('  holesail --live 3000')}

${colors.yellow('- Start a Holesail server on port 3000 for sharing with third parties (public connection string)')}
${colors.white('  holesail --live 3000 --public')}

${colors.yellow('- Start a Holesail server on port 3000 with a custom host and custom connection string:')}
${colors.white('  holesail --live 3000 --host 192.168.1.1 --connector "my-custom-connection-string-that-I-will-not-share')}

${colors.yellow('- Connect to a Holesail server with default options:')}
${colors.white('  holesail 651daf65e3892d9ca8caa3237194612f460843f522e9b505975e9c840d2158a2')}

${colors.yellow('- Connect to a Holesail server with a custom connection string and custom port:')}
${colors.white('  holesail my-custom-connection-string-that-I-will-not-share --port 8080')}

${colors.yellow('- Start a filemanager session in the current directory with default username and password:')}
${colors.white('  holesail --filemanager')}

${colors.yellow('- Start a filemanager session in the current directory with public connection string:')}
${colors.white('  holesail --filemanager --public')}

${colors.yellow('- Start a filemanager session in a custom directory with custom username:')}
${colors.white('  holesail --filemanager "/Users/supersu" --username "holesail"')}

${colors.yellow('- Start a filemanager session in a custom directory with custom username and password and admin role:')}
${colors.white('  holesail --filemanager "/Users/supersu" --username "holesail" --password "securepass@99#123" --role admin')}

${colors.bold('Notes:')}

${colors.white('- Treat Private connection strings like SSH keys. Do not share them with anyone you do not trust.')}
${colors.white('- Public connection strings should be treated like domain names on public servers. If there is any private information, it is your responsibility to protect it using passwords or connectors.')}
`,

  printHelp: function (helpMessage) {
    console.log(helpMessage)
  }
}
