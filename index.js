#!/usr/bin/env node

const DHT = require('holesail-server') //require module to start server on local port
const goodbye = require('graceful-goodbye')
const HyperDHT = require('hyperdht')
const argv = require('minimist')(process.argv.slice(2)) //required to parse cli arguments

const {
    createHash
} = require('crypto'); //for connectors

//splitting into files
const help = require('./includes/help.js');


//setting up the command hierarchy
if (argv.help) {
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
            connector = argv.connector;
            isConnectorSet = false;
        } else {
            connector = createHash('sha256').update(argv.connector.toString()).digest('hex');
            isConnectorSet = true;
        }

    } else {
        connector = null;
        isConnectorSet = false;
    }

    localServer.serve(argv.live, host, () => {

        if (isConnectorSet) {
            console.log(`Your connector is: ${argv.connector}`);
        } else {
            console.log("Notice: There is no connector set. \n");
        }

        console.log(`Server started, Now listening on ${host}:` + argv.live);
        console.log('Server public key:', localServer.getPublicKey());
    }, connector);

} else if (argv.connect) {

    //logic for holesail --connect key|seed
    //key has priority over seed

    if (argv.connect.length === 64) {
        connector = argv.connect;
        isConnectorSet = false;
    } else {
        connector = createHash('sha256').update(argv.connect.toString()).digest('hex');
        const seed = Buffer.from(connector, 'hex');
        //the keypair here is not a reference to the function above
        connector = HyperDHT.keyPair(seed).publicKey.toString('hex');
        isConnectorSet = true;
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
            console.log(`Client setup, access on http://${host}:${port}/`);

            if (isConnectorSet) {
                console.log(`Your connector is: ${argv.connect}`);
            } else {
                console.log("Notice: There is no connector set.\n");
            }

            console.log('Connected to public key:', connector);
        }
    )
} else if (argv['_'][0]) {

    //logic for holesail key|connector

    if (argv['_'][0].length === 64) {
        connector = argv['_'][0];
        isConnectorSet = false;
    } else {
        connector = createHash('sha256').update(argv['_'][0].toString()).digest('hex');
        const seed = Buffer.from(connector, 'hex');
        //the keypair here is not a reference to the function above
        connector = HyperDHT.keyPair(seed).publicKey.toString('hex');
        isConnectorSet = true;
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
            console.log(`Client setup, access on http://${host}:${port}/`);

            if (isConnectorSet) {
                console.log(`Your connector is: ${argv['_'][0]}`);
            } else {
                console.log("Notice: There is no connector set.\n");
            }

            console.log('Connected to public key:', connector);
        }
    )

} else {
    help.printHelp(help.helpMessage);
    process.exit(-1)
}

goodbye(async () => {
    await localServer.destroy()
})