#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2)); // Required to parse CLI arguments
const goodbye = require('graceful-goodbye');
const pkg = require('./package.json'); // Holds info about the current package
const Filemanager = require('./includes/livefiles.js'); // Adjust the path as needed
const { uniqueNamesGenerator, adjectives,colors,  animals } = require('unique-names-generator');

// Require all necessary files
const help = require('./includes/help.js');
const Client = require('./includes/client.js');
const Server = require('./includes/server.js');
// const { ValidateInput } = require('./includes/validateInput.js');

// Validate every input and throw errors if incorrect input
// const validator = new ValidateInput(argv);

// Function to generate default connector value
function generateConnector() {
    const randomName = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals] }); 
    return randomName;
}

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

} else if (argv.filemanager) {
    // Taking inputs from user
    const options = {
        user: argv.user,
        path: argv.filemanager,
        port: argv.port || 5409,
        connector: argv.connector,
        key: argv.key,
        username: argv.username || "admin", // If no username then by default admin
        pass: argv.pass || "admin"  // If no password then by default admin
    };
    //connector value is not given
    if (argv.connector === true) {
        console.log(`Warning: --connector provided but no value. Generating default connector value.`);
        options.connector = generateConnector();
    }

    // Check if --connector or --key is provided
    if (!options.connector  && !argv.key) {
        console.log((`Warning: Neither --connector nor --key provided. Generating default connector value.`));
        options.connector = generateConnector(); 
    }

    // Start files server
    const fileServer = new Filemanager(options.path, options.user, options.username, options.pass);
    fileServer.start(options.port);

    // Start holesail server
    const server = new Server(options);
    server.start();
    goodbye(async () => {
        await server.destroy();
    });
    goodbye(async () => {
        await fileServer.destroy();
    });

} else if (argv.connect || argv['_'][0]) {
    const keyInput = argv.connect || argv['_'][0];
    const options = {
        port: argv.port || 8989,
        host: argv.host || '127.0.0.1',
        connector: argv.connector
    };
    const client = new Client(keyInput, options);
    client.start();
} else {
    console.log(colors.red(`Error: Invalid or Incorrect arguments specified. See holesail --help for a list of all valid arguments`));
    process.exit(2);
}
