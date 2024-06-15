const DHT = require('holesail-server'); // Core component for creating a server over HyperDHT

const {createHash} = require('node:crypto'); // This will convert the connector to a seed of 64 length

const boxConsole = require('cli-box'); // Print pretty
var colors = require('colors/safe');
var qrcode = require('qrcode-terminal');

class Server {
    // Set appropriate values from options
    // NOTE: Port is taken directly from the options, this.options.port
    constructor(options) {
        this.options = options;
        this.host = options.host || '127.0.0.1';
        this.connector = this.setupConnector(options.connector);
        this.localServer = new DHT();
        this.isConnectorSet; // To enable different logic for connector/keys
    }

    // Create seed from connector or set a key if it exists
    setupConnector(connector) {

        // If there is no connector provided in options, set it to null locally
        if (!connector) {
            this.isConnectorSet = false;
            return null;
        }

        // Strings with 64 length are treated as keys, logic for holesail <key>
        if (connector.length === 64) {
            this.isConnectorSet = false;
            return connector;
        } else {
            this.isConnectorSet = true;
            return createHash('sha256').update(connector.toString()).digest('hex'); // Create seed from connector
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
                    text: colors.cyan.underline.bold("Holesail Server Started") + " ⛵️" + "\n" +
                        colors.magenta("Connection Mode: ") + colors.cyan("Super Secret connector") + "\n" +
                        colors.magenta(`Holesail is now listening on `) + `${this.host}:` + this.options.port + "\n" +
                        "Connect with connector: " + colors.white(`${this.options.connector}`) + "\n" +
                        colors.gray(`Public key is: ${this.localServer.getPublicKey()}`) + "\n" +
                        colors.gray(`   NOTE: TREAT CONNECTORS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    `),
                    autoEOL: true,
                    vAlign: "middle",
                    hAlign: "middle",
                    stretch: true
                }
            );

            console.log(box)
            console.log("OR Scan the QR to connect: ")
            let qrData = `{type: "holesail-cli", connectionMode: "key", value: ${this.options.connector}}`;
            qrcode.generate(qrData, {small: true}, function (qrcode) {
                console.log(qrcode);
            });


        } else {

            var box = boxConsole("100x10", {
                    text: colors.cyan.underline.bold("Holesail Server Started") + " ⛵️" + "\n" +
                        colors.magenta("Connection Mode: ") + colors.yellow("Publicly Sharable Key \n") +
                        colors.magenta(`Holesail is now listening on `) + `${this.host}:` + this.options.port + "\n" +
                        "Connect with key: " + colors.white(`${this.localServer.getPublicKey()}`) + "\n" +
                        colors.gray(`   NOTICE: TREAT PUBLIC KEYS LIKE YOU WOULD TREAT A DOMAIN NAME ON PUBLIC SERVER, IF THERE IS ANYTHING PRIVATE ON IT, IT IS YOUR RESPONSIBILITY TO PASSWORD PROTECT IT OR USE CONNECTORS   \n`),
                    autoEOL: true,
                    vAlign: "middle",
                    hAlign: "middle",
                    stretch: true
                }
            );
            console.log(box)
            console.log("OR Scan the QR to connect: ")
            let qrData = `{type: "holesail-cli", connectionMode: "key", value: ${this.localServer.getPublicKey()}}`;
            qrcode.generate(qrData, {small: true}, function (qrcode) {
                console.log(qrcode);
            });
        }

    }

    // Destroy DHT connection
    async destroy() {
        await this.localServer.destroy();
    }
}

module.exports = Server;
