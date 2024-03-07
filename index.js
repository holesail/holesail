#!/usr/bin/env node
const DHT = require('holesail-server') //require module to start server on local port
const goodbye = require('graceful-goodbye')
const argv = require('minimist')(process.argv.slice(2)) //required to parse cli arguments
const helpMessage = 'Usage: The command below will expose your local port to the network\nholesail --live port \n Command to connect to a holesail-server:\n holesail --connect <seed> --port <portno>'

//setting up the command hierarchy
if (argv.help) {
    console.log(helpMessage)
    process.exit(-1)
}
const localServer = new DHT();
if (argv.live) {
    localServer.serve(argv.live, '127.0.0.1', () => {
        console.log('Server started, Now listening on port ' + argv.live);
        console.log('Server public key:', localServer.getPublicKey());
    });

} else if (argv.connect) {

    if(!argv.port){
        port = 8989
    }else{
        port = argv.port
    }
    const holesailClient = require('holesail-client')
    const pubClient = new holesailClient(argv.connect)
    pubClient.connect(port, "127.0.0.1", () => {
        console.log(`Listening on 127.0.0.1:${port}`)
    })
} else {
    console.log(helpMessage);
    process.exit(-1)
}

goodbye(async () => {
    await localServer.destroy()
})