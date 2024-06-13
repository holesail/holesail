const DHT = require('holesail-server');
const { createHash } = require('node:crypto');
const boxConsole = require('cli-box');
var colors = require('colors/safe');

class Server {
    constructor(options) {
        this.options = options;
        this.host = options.host || '127.0.0.1';
        this.connector = this.setupConnector(options.connector);
        this.localServer = new DHT();
    }

    setupConnector(connector) {
        if (!connector) return null;
        if (connector.length === 64) {
            return connector;
        } else {
            return createHash('sha256').update(connector.toString()).digest('hex');
        }
    }

    start() {
        this.localServer.serve({
            port: this.options.port,
            address: this.host,
            buffSeed: this.connector,
            secure: this.connector !== null && this.connector.length !== 64
        }, () => {
            this.printBox();
        });
    }

    printBox() {
        let connectionMode, connectorText;

        if (this.connector !== null && this.connector.length !== 64) {
            connectionMode = colors.cyan("Super Secret connector");
            connectorText = "Connect with connector: " + colors.white(`${this.options.connector}`);
        } else {
            connectionMode = colors.yellow("Publicly Sharable Key \n");
            connectorText = "Connect with key: " + colors.white(`${this.localServer.getPublicKey()}`);
        }

        var box = boxConsole("100x10", {
            text: colors.cyan.underline.bold("Holesail Server Started") + " ⛵️" + "\n" +
                colors.magenta("Connection Mode: ") + connectionMode + "\n" +
                colors.magenta(`Holesail is now listening on `) + `${this.host}:` + this.options.port + "\n" +
                connectorText + "\n" +
                colors.gray(`Public key is: ${this.localServer.getPublicKey()}`) + "\n" +
                colors.gray(`   NOTE: TREAT CONNECTORS HOW YOU WOULD TREAT SSH KEY, DO NOT SHARE IT WITH ANYONE YOU DO NOT TRUST    `),
            autoEOL: true,
            vAlign: "middle",
            hAlign: "middle",
            stretch: true
        });
        console.log(box);
    }

    async destroy() {
        await this.localServer.destroy();
    }
}

module.exports = Server;
