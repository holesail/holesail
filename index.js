#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2)); // Required to parse CLI arguments
const goodbye = require('graceful-goodbye');
const pkg = require('./package.json'); // Holds info about the current package

var colors = require('colors/safe');


// Require all necessary files
const help = require('./includes/help.js');
const Client = require('./includes/client.js');
const Server = require('./includes/server.js');
const Filemanager = require('./includes/livefiles.js'); // Adjust the path as needed
const { ValidateInput } = require('./includes/validateInput.js');

// Validate every input and throw errors if incorrect input
const validator = new ValidateInput(argv);


// Setting up the command hierarchy
// Display help and exit
if (argv.help) {
    help.printHelp(help.helpMessage);
    process.exit(-1);
}

// Display version and exit
if (argv.version) {
    console.log(pkg.version);
    process.exit(-1);
}

// Set a port live
if (argv.live) {
    const options = {
        port: argv.live,
        host: argv.host,
        connector: argv.connector,
        public: argv.public,
        service: "Server"
    };
    const server = new Server(options);
    server.start();
    goodbye(async () => {
        await server.destroy();
    });

} else if (argv.connect || argv['_'][0]) { // Establish connection with a peer
    const keyInput = argv.connect || argv['_'][0];
    const options = {
        port: argv.port || 8989,
        host: argv.host || '127.0.0.1',
        connector: argv.connector
    };
    const client = new Client(keyInput, options);
    client.start();
} else if (argv.filemanager) { // Start server with a filemanager

    const options = {

        //options for the file manager
        path: argv.filemanager,
        username: argv.username,
        password: argv.password,
        role: argv.role,

        //options for holesail-server
        port: argv.port,
        connector: argv.connector,
        public: argv.public,
        service: "Filemanager"
    };

    // Start files server
    const fileServer = new Filemanager(options);
    fileServer.start();
    //destroy before exiting
    goodbye(async () => {
        await fileServer.destroy();
    });

} else { // Default if no correct option is chosen
    console.log(colors.red(`Error: Invalid or Incorrect arguments specified. See holesail --help for a list of all valid arguments`));
    process.exit(2);
}
