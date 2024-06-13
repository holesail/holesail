const boxConsole = require('cli-box');
var colors = require('colors/safe');
const b4a = require('b4a');
const { createHash } = require('node:crypto');
const holesailClient = require('holesail-client');

class Client {
    constructor(keyInput, options) {
        this.keyInput = keyInput;
        this.options = options;
        this.isConnectorSet = false;
        this.connector = this.setupConnector(keyInput);
        this.host = options.host || '127.0.0.1';
        this.port = options.port || 8989;
        this.pubClient = this.initializeClient();
    }

    setupConnector(keyInput) {
        if (keyInput.length === 64) {
            this.isConnectorSet = false;
            return keyInput;
        } else {
            const connector = createHash('sha256').update(keyInput.toString()).digest('hex');
            this.isConnectorSet = true;
            const seed = Buffer.from(connector, 'hex');
            return b4a.toString(seed, 'hex');
        }
    }

    initializeClient() {
        if (this.isConnectorSet) {
            return new holesailClient(this.connector, "secure");
        } else {
            return new holesailClient(this.connector);
        }
    }

    start() {
        this.pubClient.connect({ port: this.port, address: this.host }, () => {
            if (this.isConnectorSet) {
                this.printBox("Super Secret Connector", "Connected to Secret Connector: " + colors.white(this.keyInput));
            } else {
                this.printBox("Publicly Sharable Key", "");
            }
        });
    }

    printBox(connectionMode, additionalText) {
        var box = boxConsole("100x10", {
            text: colors.cyan.underline.bold("Holesail Client Started") + " ⛵️" + "\n" +
                colors.magenta("Connection Mode: ") + colors.green(connectionMode) + "\n" +
                colors.magenta(`Access application on http://${this.host}:${this.port}/`) + "\n" +
                additionalText +
                colors.gray(`Public key: ${this.connector}`) + "\n" +
                colors.gray(`   NOTE: TREAT CONNECTORS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    `),
            autoEOL: true,
            vAlign: "middle",
            hAlign: "middle",
            stretch: true
        });
        console.log(box);
    }
}

module.exports = Client;
