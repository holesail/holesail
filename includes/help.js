module.exports = {
    helpMessage: 'Usage: The command below will expose your local port to the network\nholesail --live port \n Command to connect to a holesail-server:\n holesail --connect <seed> --port <portno>. You can use the  --host option to change host, the default is 127.0.0.1',
    printHelp: function(helpMessage) {
        console.log(helpMessage);
    }
}
