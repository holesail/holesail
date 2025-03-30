#!/usr/bin/env node
import { runtime } from 'which-runtime';
runtime === 'bare' && (process = require('bare-process'));
import minimist from 'minimist'; // Required to parse CLI arguments
import goodbye from 'graceful-goodbye';
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { version } = require('./package.json')

import colors from 'colors/safe.js';
const argv = minimist(process.argv.slice(2));
// Require all necessary files
import * as help from './includes/help.js';
import Client from './includes/client.js';
import Server from './includes/server.js';
import Filemanager from './includes/livefiles.js'; // Adjust the path as needed

// Validate every input and throw errors if incorrect input
import validateInput from './includes/validateInput.js';
validateInput(argv);

// Display help and exit
if (argv.help) {
  help.printHelp(help.helpMessage);
  process.exit(0);
}

// Display version and exit
if (argv.version) {
  console.log(version);
  process.exit(0);
}

if (argv.list || argv.delete || argv.stop || argv.start || argv.background || argv.logs) {
  if (runtime === 'bare') {
    console.log('Info: Running Holesail in background is not supported on bare');
    process.exit(0);
  }

  const { PM2list, PM2delete, PM2stop, PM2start, PM2create, PM2logs } = await import('barely-pm2');
  if (argv.list) {
    PM2list({ raw: true, name: 'holesail' });
  }

  if (argv.delete) {
    PM2delete(argv.delete);
  }

  if (argv.stop) {
    PM2stop(argv.stop);
  }

  if (argv.start) {
    PM2start(argv.start);
  }

  if (argv.logs) {
    PM2logs(argv.logs);
  }

  if (argv.background) {
    const arr = ['list', 'delete', 'stop', 'start', 'background'];
    arr.forEach(key => {
      delete argv[key];
    });

    const scriptArgs = Object.entries(argv).flatMap(([key, value]) => {
      return key === '_' ? value : [`--${key}`, value];
    });

    PM2create({ name: 'holesail-' + argv.name || `holesail-${Date.now()}`, script: __filename, args: scriptArgs, timeout: '5000' });
  }
} else {
  // Set a port live
  if (argv.live) {
    const options = {
      port: argv.live,
      host: argv.host,
      connector: argv.connector,
      public: argv.public,
      service: 'Server',
      udp: argv.udp
    };
    const server = new Server(options);
    await server.start();
    goodbye(async () => {
      await server.destroy();
    });
  } else if (argv.connect || argv._[0]) { // Establish connection with a peer
    const keyInput = argv.connect || argv._[0];
    const options = {
      port: argv.port,
      host: argv.host,
      connector: argv.connector,
      udp: argv.udp
    };
    const client = new Client(keyInput, options);
    client.start();
  } else if (argv.filemanager) { // Start server with a filemanager
    const options = {
      // options for the file manager
      path: argv.filemanager,
      username: argv.username,
      password: argv.password,
      role: argv.role,

      // options for holesail-server
      port: argv.port,
      connector: argv.connector,
      public: argv.public,
      service: 'Filemanager'
    };

    // Start files server
    const fileServer = new Filemanager(options);
    fileServer.start();
    // destroy before exiting
    goodbye(async () => {
      await fileServer.destroy();
    });
  } else { // Default if no correct option is chosen
    console.log(colors.red('Error: Invalid or Incorrect arguments specified. See holesail --help for a list of all valid arguments'));
    process.exit(2);
  }
}
