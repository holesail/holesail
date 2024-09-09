import DHT from 'holesail-server'; // Core component for creating a server over HyperDHT
import libKeys from 'hyper-cmd-lib-keys'; // generate a random seed
import b4a from 'b4a'; //generate random connector
import { encodeAddress } from 'hyper-address'; // encode connection string to .hyper address

import { createHash } from 'node:crypto'; // This will convert the connector to a seed of 64 length

import boxConsole from 'cli-box'; // Print pretty
import colors from 'colors/safe.js';
import qrcode from 'qrcode-terminal';

class Server {
    // Set appropriate values from options
    // NOTE: Port is taken directly from the options, this.options.port
    constructor(options) {
        this.options = options;
        this.host = options.host || '127.0.0.1';
        this.public = options.public;
        this.connector = this.setupConnector(options.connector);
        this.localServer = new DHT();
        this.isConnectorSet; // To enable different logic for connector/keys

        this.service = options.service;
        this.customText = options.customText || "";
    }

    // Logic for handling default (connector) mode and public mode
    setupConnector(connector) {

        // Use keys if public mode is enabled
        if (this.public){
            this.isConnectorSet = false;
            return null; // Setting the connector null locally will result in a key generation by holesail-client
        }

        // generate seed from, if a custom connector is supplied.
        if (connector && typeof(connector) != "boolean") {
            this.isConnectorSet = true;
            return createHash('sha256').update(connector.toString()).digest('hex'); // Create seed from connector
        }else{
            let buffer = Buffer.from(libKeys.randomBytes(32).toString('hex'), 'hex');// Generate a random buffer
            let connectorSeed = b4a.toString(buffer, 'hex').substring(0,60); // Generate connector from buffer and trim to 60 chars
            this.options.connector = connectorSeed // Hi-jack connector parameter so the code for QR code and printbox passes.

            this.isConnectorSet = true;
            return createHash('sha256').update(connectorSeed.toString()).digest('hex'); // Create seed from connector
        }
    }

    // Call holesail-server on demand with options
    start() {
        this.localServer.serve({
            port: this.options.port,
            address: this.host,
            buffSeed: this.connector,
            secure: this.isConnectorSet
        }, () => {
            this.printBox();
        });
    }

    printBox() {
        // Pretty output in the terminal
        if (this.isConnectorSet) {
            var box = boxConsole("100x10", {
                    text: colors.cyan.underline.bold(`Holesail ${this.service} Started`) + " ⛵️" + "\n" +
                        colors.magenta("Connection Mode: ") + colors.cyan("Private Connection String") + "\n" +
                        colors.magenta(`Holesail is now listening on `) + `${this.host}:` + this.options.port + "\n" +
                        colors.green(this.customText) +
                        "Connection string: " + colors.white(`${this.options.connector}`) + "\n" +
                        colors.gray(`   NOTE: TREAT PRIVATE CONNECTION STRINGS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    `),
                    autoEOL: true,
                    vAlign: "middle",
                    hAlign: "middle",
                    stretch: true
                }
            );

            console.log(box)
            console.log("OR Scan the QR to connect: ")
            qrcode.generate(this.options.connector, {small: true}, function (qrcode) {
                console.log(qrcode);
            });


        } else {

            var pubkey = this.localServer.getPublicKey();
            var box = boxConsole("100x10", {
                    text: colors.cyan.underline.bold(`Holesail ${this.service} Started`) + " ⛵️" + "\n" +
                        colors.magenta("Connection Mode: ") + colors.yellow("Public Connection String \n") +
                        colors.magenta(`Holesail is now listening on `) + `${this.host}:` + this.options.port + "\n" +
                        colors.green(this.customText) +
                        "Connection string: " + colors.white(`${pubkey}`) + "\n" +
                        "Hyper Address: " + colors.white(`${encodeAddress(pubkey)}`) + "\n" +
                        colors.gray(`   NOTICE: TREAT PUBLIC STRING LIKE YOU WOULD TREAT A DOMAIN NAME ON PUBLIC SERVER, IF THERE IS ANYTHING PRIVATE ON IT, IT IS YOUR RESPONSIBILITY TO PASSWORD PROTECT IT OR USE PRIVATE MODE   \n`),
                    autoEOL: true,
                    vAlign: "middle",
                    hAlign: "middle",
                    stretch: true
                }
            );
            console.log(box)
            console.log("OR Scan the QR to connect: ")
            qrcode.generate(pubkey, {small: true}, function (qrcode) {
                console.log(qrcode);
            });
        }

    }

    // Destroy DHT connection
    async destroy() {
        await this.localServer.destroy();
    }
}

export default Server;
