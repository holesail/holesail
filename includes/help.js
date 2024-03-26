module.exports = {
    helpMessage: 'Usage: The command below will expose your local port to the network\nholesail --live port [--host host] [--connector connector]\n Command to connect to a holesail-server:\n holesail --connect <seed> --port <portno> [--host host]\n Additional options:\n --help: displays this help message\n --live: starts the server to expose local port to the network\n --connect: connects to a holesail-server with the provided seed\n --port: specifies the port number for the server or client connection\n --host: specifies the host address for the server or client connection (default is 127.0.0.1)\n --connector: provides the connector for the server or client connection (default is null or automatically generated)\n',
    printHelp: function(helpMessage) {
        console.log(helpMessage);
    }
}
