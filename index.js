#!/usr/bin/env node

const DHT = require('holesail-server') //require module to start server on local port
const goodbye = require('graceful-goodbye')
const HyperDHT = require('hyperdht')
const argv = require('minimist')(process.argv.slice(2)) //required to parse cli arguments

const {
    createHash
} = require('node:crypto'); //for connectors

//version info
const version = "1.4.10";

//splitting into files
const help = require('./includes/help.js');

//setting up the command hierarchy

//display help and exit
if (argv.help) {
    help.printHelp(help.helpMessage);
    process.exit(-1)
}

//display version and exit
if (argv.version) {
    console.log(version);
    process.exit(-1);
}

const localServer = new DHT();
if (argv.live) {
    // user sets the custom host address for the server or use 127.0.0.1
    if (argv.host) {
        host = argv.host
    } else {
        host = '127.0.0.1'
    }
    //if the connector length is 64 consider it as a seed or else create a seed from the connector
    //this lets the user pair with strings instead of long seeds
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

    localServer.serve({port: argv.live, address: host, buffSeed: connector, secure: isConnectorSet}, () => {

        if (isConnectorSet) {
            console.log(`Your connector is: ${argv.connector}`);
        } else {
            console.log("Notice: There is no connector set. \n");
        }

        console.log(`Server started, Now listening on ${host}:` + argv.live);
        console.log('Server public key:', localServer.getPublicKey());
    });

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
    if (isConnectorSet) {
        const pubClient = new holesailClient(connector, "secure");
    } else {
        const pubClient = new holesailClient(connector);
    }

    pubClient.connect({port: port, address: host}, () => {
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
    if (isConnectorSet) {
        const pubClient = new holesailClient(connector, "secure")
    } else {
        const pubClient = new holesailClient(connector)
    }

    pubClient.connect({port: port, address: host}, () => {
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