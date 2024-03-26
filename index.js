#!/usr/bin/env node

const DHT = require('holesail-server') //require module to start server on local port
const goodbye = require('graceful-goodbye')
const HyperDHT = require('hyperdht')
const argv = require('minimist')(process.argv.slice(2)) //required to parse cli arguments
const {
    createHash
} = require('crypto'); //for connectors
//setting up the command hierarchy
if (argv.help) {
    const help = require('./includes/help.js');
    help.printHelp(help.helpMessage);
    process.exit(-1)
}


const localServer = new DHT();
if (argv.live) {
    // --host
    if (argv.host) {
        host = argv.host
    } else {
        host = '127.0.0.1'
    }
    //to preserve seed
    if (argv.connector) {
        if (argv.connector.length === 64) {
            connector = argv.connector
        } else {
            connector = createHash('sha256').update(argv.connector.toString()).digest('hex');
        }

    } else {
        connector = null
    }

    localServer.serve(argv.live, host, () => {
        console.log(`Server started, Now listening on ${host}:` + argv.live);
        console.log(`Your connector is: ${argv.connector}`);
        console.log('Server public key:', localServer.getPublicKey());
    }, connector);

} else if (argv.connect) {

    //give priority to connector instead of connection seed
    if (argv.connector) {
        if (argv.connector.length === 64) {
            connector = argv.connector
        } else {
            connector = createHash('sha256').update(argv.connector.toString()).digest('hex');
            const seed = Buffer.from(connector, 'hex');
            //the keypair here is not a reference to the function above
            connector = HyperDHT.keyPair(seed).publicKey.toString('hex');
        }

    } else {
        connector = argv.connect
    }

    if (!argv.port) {
        port = 8989
    } else {
        port = argv.port
    }
    //--host
    if (argv.host) {
        host = argv.host
    } else {
        host = '127.0.0.1'
    }

    const holesailClient = require('holesail-client')
    const pubClient = new holesailClient(connector)
    pubClient.connect(port, host, () => {
        console.log(`Client setup, access on ${host}:${port}`);
        console.log(`Your connector is: ${argv.connector}`);
        console.log('Connected to public key:', connector);
        }
    )
} else {
    console.log(helpMessage);
    process.exit(-1)
}

goodbye(async () => {
    await localServer.destroy()
})