#!/usr/bin/env node

const DHT = require('holesail-server') //require module to start server on local port
const goodbye = require('graceful-goodbye')
const HyperDHT = require('hyperdht')

const argv = require('minimist')(process.argv.slice(2)) //required to parse cli arguments
const b4a = require('b4a')
const {createHash} = require('node:crypto'); //for connectors
const pkg = require('./package.json'); //holds info about current package

const boxConsole = require('cli-box');
var colors = require('colors/safe');


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
    console.log(pkg.version);
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

            var box = boxConsole("100x10", {
                    text: colors.cyan.underline.bold("Holesail Server Started") + " ⛵️" + "\n" +
                        colors.magenta("Connection Mode: ") + colors.cyan("Super Secret connector") + "\n" +
                        colors.magenta(`Holesail is now listening on `) + `${host}:` + argv.live + "\n" +
                        "Connect with connector: " + colors.white(`${argv.connector}`) + "\n" +
                        colors.gray(`Public key is: ${localServer.getPublicKey()}`) + "\n" +
                        colors.gray(`   NOTE: TREAT CONNECTORS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    `),
                    autoEOL: true,
                    vAlign: "middle",
                    hAlign: "middle",
                    stretch: true
                }
            );
            console.log(box)

        } else {

            var box = boxConsole("100x10", {
                    text: colors.cyan.underline.bold("Holesail Server Started") + " ⛵️" + "\n" +
                        colors.magenta("Connection Mode: ") + colors.yellow("Publicly Sharable Key \n") +
                        colors.magenta(`Holesail is now listening on `) + `${host}:` + argv.live + "\n" +
                        "Connect with key: " + colors.white(`${localServer.getPublicKey()}`) + "\n" +
                        colors.gray(`   NOTICE: TREAT PUBLIC KEYS LIKE YOU WOULD TREAT A DOMAIN NAME ON PUBLIC SERVER, IF THERE IS ANYTHING PRIVATE ON IT, IT IS YOUR RESPONSIBILITY TO PASSWORD PROTECT IT OR USE CONNECTORS   \n`),
                    autoEOL: true,
                    vAlign: "middle",
                    hAlign: "middle",
                    stretch: true
                }
            );
            console.log(box)

        }

    });

} else if (argv.connect || argv['_'][0]) {


    //logic for holesail --connect key|connector and holesail key|connector
    //key has priority over connector
    let keyInput;
    if (argv.connect) {
        keyInput = argv.connect;
    } else {
        keyInput = argv['_'][0];
    }

    //64 char long is treated as key, avoid 64 char long connectors
    if (keyInput.length === 64) {
        connector = keyInput;
        isConnectorSet = false;
    } else {
        connector = createHash('sha256').update(keyInput.toString()).digest('hex');
        const seed = Buffer.from(connector, 'hex');
        //the keypair here is not a reference to the function above
        connector = b4a.toString(seed, 'hex');
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
    var pubClient;
    if (isConnectorSet) {
        pubClient = new holesailClient(connector, "secure");
    } else {
        pubClient = new holesailClient(connector);
    }
    pubClient.connect({port: port, address: host}, () => {

            if (isConnectorSet) {

                var box = boxConsole("100x10", {
                        text: colors.cyan.underline.bold("Holesail Client Started") + " ⛵️" + "\n" +
                            colors.magenta("Connection Mode: ") + colors.green("Super Secret Connector") + "\n" +
                            colors.magenta(`Access application on http://${host}:${port}/`) + "\n" +
                            "Connected to Secret Connector: " + colors.white(keyInput) + "\n" +
                            colors.gray(`Public key: ${connector}`) + "\n" +
                            colors.gray(`   NOTE: TREAT CONNECTORS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    `),
                        autoEOL: true,
                        vAlign: "middle",
                        hAlign: "middle",
                        stretch: true
                    }
                );
                console.log(box)

            } else {

                var box = boxConsole("100x10", {
                        text: colors.cyan.underline.bold("Holesail Client Started") + " ⛵️" + "\n" +
                            colors.magenta("Connection Mode: ") + colors.yellow("Publicly Sharable Key") + "\n" +
                            colors.magenta(`Access application on http://${host}:${port}/`) + "\n" +
                            colors.gray(`Public key: ${connector}`) + "\n" +
                            colors.gray(`   NOTICE: TREAT PUBLIC KEYS LIKE YOU WOULD TREAT A DOMAIN NAME ON PUBLIC SERVER, IF THERE IS ANYTHING PRIVATE ON IT, IT IS YOUR RESPONSIBILITY TO PASSWORD PROTECT IT OR USE CONNECTORS   `),
                        autoEOL: true,
                        vAlign: "middle",
                        hAlign: "middle",
                        stretch: true
                    }
                );
                console.log(box)

            }


        }
    )
} else {
    help.printHelp(help.helpMessage);
    process.exit(-1)
}

goodbye(async () => {
    await localServer.destroy()
})