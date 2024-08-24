#!/usr/bin/env node

const pm2 = require('pm2');
const minimist = require('minimist');
const { spawn } = require('child_process');

const path = require('path');
const fs = require('fs');

const args = minimist(process.argv.slice(2));

const command = args._[0]; // Get the command argument
const processName = args._[1]; // The second non-option argument (used as process name)
const customName = args.name; // Custom name for the PM2 process

// Path to the local pm2 binary
const pm2Binary = path.join(__dirname, 'node_modules', 'pm2', 'bin', 'pm2');

// Helper function to filter out `--name` and its associated value
// We don't want to pass --name or it's value to holesail or the client will bug out
function filterArgs(argv) {
    const filteredArgs = [];
    let skipNext = false;

    for (let i = 0; i < argv.length; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        if (argv[i] === '--name') {
            skipNext = true;
        } else if (argv[i].startsWith('--name=')) {
            // Skip the argument with --name=value
            continue;
        } else {
            filteredArgs.push(argv[i]);
        }
    }

    return filteredArgs;
}

// Create a new holesail connection
// This will pass every single parameter over to holesail, run it and print logs

if (command === 'create') {
    const name = customName || `holesail-${Date.now()}`; // Custom name or unique timestamped name

    // Get the holesail command parameters excluding `--name`
    const holesailArgs = filterArgs(process.argv.slice(3));

    pm2.connect((err) => {
        if (err) {
            console.error('Error connecting to pm2:', err);
            process.exit(2);
        }

        pm2.start({
            name: name,
            script: './index.js', // Run the holesail script through index.js
            args: holesailArgs,
        }, (err) => {
            if (err) {
                pm2.disconnect();
                console.error('Failed to start holesail:', err);
                process.exit(2);
            }

            console.log(`Holesail session started with name: ${name}`);
            // Now capture the logs
            // This will capture first few logs and print them
            // We need it to see the connection information
            pm2.launchBus((err, bus) => {
                if (err) {
                    console.error('Error launching log bus:', err);
                    pm2.disconnect();
                    return;
                }

                bus.on('log:out', (packet) => {
                    if (packet.process.name === name) {
                        // Strip the PM2 prefix and display only the actual log message
                        const logMessage = packet.data.replace(/^\[.*\]\s*/, '');
                        console.log(logMessage);
                    }
                });

                bus.on('log:err', (packet) => {
                    if (packet.process.name === name) {
                        // Strip the PM2 prefix and display only the actual log message
                        const logMessage = packet.data.replace(/^\[.*\]\s*/, '');
                        console.error(logMessage);
                    }
                });

                // Disconnect from PM2 after a brief period, assuming the logs are captured
                // There is a little chance that the host OS processed the request slow
                // and holesail did not establish a connection in the first 5 seconds.
                // Users will need to run the view log command.
                setTimeout(() => pm2.disconnect(), 5000);
            });
        });
    });

} else if (command === 'list') {
    // List all the running holesail connections
    // Need to spwan or else PM2 will display full black and white
  const child = spawn('node', [pm2Binary, 'list'], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: 'true' } // Force color output
  });

  child.on('error', (err) => {
    console.error('Error listing PM2 processes:', err);
    process.exit(2);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`PM2 exited with code ${code}`);
      process.exit(code);
    }
  });


} else if (command === 'delete') {
    // Handle deletion of connections
    if (!processName) {
        console.error('Please specify a session name to delete');
        process.exit(1);
    }

    pm2.connect((err) => {
        if (err) {
            console.error('Error connecting to pm2:', err);
            process.exit(2);
        }

        pm2.delete(processName, (err) => {
            pm2.disconnect();
            if (err) {
                console.error(`Failed to delete holesail session with name: ${processName}`, err);
                process.exit(2);
            }
            console.log(`Holesail session deleted: ${processName}`);
        });
    });

} else if (command === 'start') {
    // Start a new holesail connection

    if (!processName) {
        console.error('Please specify a session name to start');
        process.exit(1);
    }

    pm2.connect((err) => {
        if (err) {
            console.error('Error connecting to pm2:', err);
            process.exit(2);
        }

        pm2.start(processName, (err) => {
            pm2.disconnect();
            if (err) {
                console.error(`Failed to start holesail session with name: ${processName}`, err);
                process.exit(2);
            }
            console.log(`Holesail session started with name: ${processName}`);
        });
    });

} else if (command === 'stop') {
    // Handle stopping processes
    if (!processName) {
        console.error('Please specify a session name to stop');
        process.exit(1);
    }

    pm2.connect((err) => {
        if (err) {
            console.error('Error connecting to pm2:', err);
            process.exit(2);
        }

        pm2.stop(processName, (err) => {
            pm2.disconnect();
            if (err) {
                console.error(`Failed to stop holesail session with name: ${processName}`, err);
                process.exit(2);
            }
            console.log(`Holesail session stopped: ${processName}`);
        });
    });

} else if (command === 'view' || command === 'logs') {
    // View logs of a specific connection
    if (!processName) {
        console.error('Please specify a session name to view logs');
        process.exit(1);
    }

    pm2.connect((err) => {
        if (err) {
            console.error('Error connecting to pm2:', err);
            process.exit(2);
        }

        // First, display the existing logs
        pm2.describe(processName, (err, processDescription) => {
            if (err || !processDescription.length) {
                console.error(`Failed to describe holesail session with name: ${processName}`, err);
                pm2.disconnect();
                process.exit(2);
            }

            const logFilePath = processDescription[0].pm2_env.pm_out_log_path;
            const errorLogFilePath = processDescription[0].pm2_env.pm_err_log_path;

            if (fs.existsSync(logFilePath)) {
                console.log('--- STDOUT LOGS ---');
                const stdoutLogs = fs.readFileSync(logFilePath, 'utf-8');
                console.log(stdoutLogs);
            }

            if (fs.existsSync(errorLogFilePath)) {
                console.log('--- STDERR LOGS ---');
                const stderrLogs = fs.readFileSync(errorLogFilePath, 'utf-8');
                console.error(stderrLogs);
            }

            // Then, start watching for new logs
            pm2.launchBus((err, bus) => {
                if (err) {
                    console.error('Error launching log bus:', err);
                    pm2.disconnect();
                    return;
                }

                bus.on('log:out', (packet) => {
                    if (packet.process.name === processName) {
                        const logMessage = packet.data.replace(/^\[.*\]\s*/, '');
                        console.log(logMessage);
                    }
                });

                bus.on('log:err', (packet) => {
                    if (packet.process.name === processName) {
                        const logMessage = packet.data.replace(/^\[.*\]\s*/, '');
                        console.error(logMessage);
                    }
                });

                // Keep the connection open to keep streaming logs
            });
        });
    });

} else {
    // Print the help command
    console.log('Usage: holesail-manager <command> [processName] [options]');
    console.log('Commands:');
    console.log('  create    Create a new holesail session');
    console.log('  list      List all running holesail sessions');
    console.log('  delete    Delete a holesail session');
    console.log('  start     Start a stopped holesail session');
    console.log('  stop      Stop a running holesail session');
    console.log('  view      View logs of a running holesail session');
    console.log('Options:');
    console.log('  --name    Specify a custom name for the session (used only for create)');
    console.log('Examples:');
    console.log('  holesail-manager create --live 3000 --name mysession');
    console.log('  holesail-manager list');
    console.log('  holesail-manager delete mysession');
    console.log('  holesail-manager start mysession');
    console.log('  holesail-manager stop mysession');
    console.log('  holesail-manager view mysession');
}