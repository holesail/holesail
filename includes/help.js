const colors = require('colors/safe');

module.exports = {
    helpMessage: `
${colors.cyan.bold('Holesail Help')}

${colors.bold('Description:')}
${colors.white('Holesail is a tool that allows you to expose your local server over P2P network or connect to a Holesail server.')}

${colors.bold('Usage:')}

${colors.yellow('- Start a Holesail server:')}
${colors.white('  holesail --live <port> [--host <host>] [--connector <connector>]')}

${colors.yellow('- Connect to a Holesail server:')}
${colors.white('  holesail --connect <key|connector> [--port <port>] [--host <host>]')}

${colors.bold('Options:')}

${colors.yellow('- --help')}
${colors.white('  Displays this help message and exits.')}

${colors.yellow('- --version')}
${colors.white('  Displays the version of the Holesail package and exits.')}

${colors.yellow('- --live <port>')}
${colors.white('  Starts a Holesail server on the specified <port>.')}

${colors.yellow('- --connect <key|connector>')}
${colors.white('  Connects to a Holesail server using the specified <key> or <connector>.')}

${colors.yellow('- --port <port>')}
${colors.white('  Specifies the port number for the server or client connection.\n  Default: 8989.')}

${colors.yellow('- --host <host>')}
${colors.white('  Specifies the host address for the server or client connection.\n  Default: 127.0.0.1.')}

${colors.yellow('- --connector <connector>')}
${colors.white('  Provides a custom connector for the server or client connection.\n  If the connector length is 64, it is treated as a key. Otherwise, a key is created from the connector.')}

${colors.bold('Examples:')}

${colors.yellow('- Start a Holesail server on port 3000 with default host and no connector:')}
${colors.white('  holesail --live 3000')}

${colors.yellow('- Start a Holesail server on port 3000 with a custom host and connector:')}
${colors.white('  holesail --live 3000 --host 192.168.1.1 --connector myCustomConnector')}

${colors.yellow('- Connect to a Holesail server with a specified key and default port:')}
${colors.white('  holesail 651daf65e3892d9ca8caa3237194612f460843f522e9b505975e9c840d2158a2')}

${colors.yellow('- Connect to a Holesail server with a specified connector and custom port:')}
${colors.white('  holesail myCustomConnector --port 8080')}

${colors.bold('Notes:')}

${colors.white('- Treat connectors like SSH keys. Do not share them with anyone you do not trust.')}
${colors.white('- Public keys should be treated like domain names on public servers. If there is any private information, it is your responsibility to protect it using passwords or connectors.')}
`,

    printHelp: function(helpMessage) {
        console.log(helpMessage);
    }
};
