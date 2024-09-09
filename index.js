#!/usr/bin/env node

import minimist from 'minimist'; // Required to parse CLI arguments
import goodbye from 'graceful-goodbye';
import fs from 'node:fs';
import pkg from './package.json' assert { type: 'json' }; // Holds info about the current package

import colors from 'colors/safe.js';

// Parse CLI arguments
const argv = minimist(process.argv.slice(2));

// Require all necessary files
import { helpMessage, printHelp } from './includes/help.js';
import Client from './includes/client.js';
import Server from './includes/server.js';
import Filemanager from './includes/livefiles.js'; // Adjust the path as needed
import { ValidateInput } from './includes/validateInput.js';

// Validate every input and throw errors if incorrect input
const validator = new ValidateInput(argv);


// Setting up the command hierarchy
// Display help and exit
if (argv.help) {
    printHelp(helpMessage);
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
} else if ( argv.filemanager ) { // Start server with a filemanager

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
