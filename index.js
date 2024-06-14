#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2)); //required to parse cli arguments
const goodbye = require('graceful-goodbye');
const pkg = require('./package.json'); //holds info about current package

const help = require('./includes/help.js');
const Client = require('./includes/client.js');
const Server = require('./includes/server.js');
const { ValidateInput } = require('./includes/validateInput.js');


//validate every input and throw errors if incorrect input
const validator = new ValidateInput(argv);


//setting up the command hierarchy
//display help and exit
if (argv.help) {
    help.printHelp(help.helpMessage);
    process.exit(-1);
}

//display version and exit
if (argv.version) {
    console.log(pkg.version);
    process.exit(-1);
}

if (argv.live) {
    const options = {
        port: argv.live,
        host: argv.host,
        connector: argv.connector
    };
    const server = new Server(options);
    server.start();
    goodbye(async () => {
        await server.destroy();
    });

} else if (argv.connect || argv['_'][0]) {
    const keyInput = argv.connect || argv['_'][0];
    const options = {
        port: argv.port || 8989,
        host: argv.host || '127.0.0.1'
    };
    const client = new Client(keyInput, options);
    client.start();
} else {
    help.printHelp(help.helpMessage);
    process.exit(-1);
}
