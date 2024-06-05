module.exports = {
    helpMessage: `
    Holesail Help

    Description:
    Holesail is a tool that allows you to expose your local server over P2P network or connect to a Holesail server.

    Usage:

    - Start a Holesail server:
      holesail --live <port> [--host <host>] [--connector <connector>]

    - Connect to a Holesail server:
      holesail --connect <key|connector> [--port <port>] [--host <host>]

    Options:

    - --help
      Displays this help message and exits.

    - --version
      Displays the version of the Holesail package and exits.

    - --live <port>
      Starts a Holesail server on the specified <port>.

    - --connect <key|connector>
      Connects to a Holesail server using the specified <key> or <connector>.

    - --port <port>
      Specifies the port number for the server or client connection.
      Default: 8989.

    - --host <host>
      Specifies the host address for the server or client connection.
      Default: 127.0.0.1.

    - --connector <connector>
      Provides a custom connector for the server or client connection.
      If the connector length is 64, it is treated as a key. Otherwise, a key is created from the connector.

    Examples:

    - Start a Holesail server on port 3000 with default host and no connector:
      holesail --live 3000

    - Start a Holesail server on port 3000 with a custom host and connector:
      holesail --live 3000 --host 192.168.1.1 --connector myCustomConnector

    - Connect to a Holesail server with a specified key and default port:
      holesail 651daf65e3892d9ca8caa3237194612f460843f522e9b505975e9c840d2158a2

    - Connect to a Holesail server with a specified connector and custom port:
      holesail myCustomConnector --port 8080

    Notes:

    - Treat connectors like SSH keys. Do not share them with anyone you do not trust.
    - Public keys should be treated like domain names on public servers. If there is any private information, it is your responsibility to protect it using passwords or connectors.
    `,

    printHelp: function(helpMessage) {
        console.log(helpMessage);
    }
}
