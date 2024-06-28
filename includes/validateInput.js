// 0 (success): The process completed successfully.
// 1 (general error): The process encountered an error or failed to complete.
// 2 (invalid argument): The process received an invalid argument.
// 3 (fatal error): The process encountered a fatal error.
// 4 (internal error): The process encountered an internal error.
// 5 (unknown error): The process encountered an unknown error.

var colors = require('colors/safe');

// ValidateInput class definition
class ValidateInput {
    // Constructor
    constructor(args) {
        this.validateInput(args);
    }

    // Function to validate input
    validateInput(args) {
        // Validation logic

        // Server and client are not supported at the same time
        if (args.live && (args.connect || args['_'][0])) {
            console.log(colors.red("Error: You can't start a server and client at the same time. Kindly check and fix your inputs, see holesail --help"));
            process.exit(2);
        }

        // 64 length string is considered a key not a connector
        if (args.connector && args.connector.length === 64) {
            console.log(colors.red("Error: Connectors can not be of length 64, any string with length 64 is considered a key, see holesail --help on how to use a connector"));
            process.exit(2);
        }

        // Can't use two keys, can we?
        if ((args.connect && args['_'][0])) {
            console.log(colors.red("Error: Lmao, are you trying to use two keys at once? Get some holesail --help mate"));
            process.exit(2);
        }

        // Throw error if specified connector is empty
        if (args.connector && typeof (args.connector) === "boolean") {
            console.log(colors.red("Error: You have specified an empty connector. Run holesail --help to see examples and how to use connectors"));
            process.exit(2);
        }

        // Port should be a number
        if (args.live && typeof (args.live) != "number") {
            console.log(colors.red(`Error: Given port is not a valid number. Run holesail --help to see examples`));
            process.exit(2);
        }

        // Port should be a number
        if (args.port && typeof (args.port) != "number") {
            console.log(colors.red(`Error: Given port is not a valid number. Run holesail --help to see examples`));
            process.exit(2);
        }

        // Handle file manager
        if (args.live && args.filemanager) {
            console.log(colors.red(`Error: You can't start holesail server and filemanager at the same time. If you are trying to use filemanager on a specific local port use --port instead or see holesail --help`));
            process.exit(2);
        }

        if (args.filemanager && (args.connect || args['_'][0])) {
            console.log(colors.red(`Error: You tried to create a connection and start filemanager at once. Start them separately and check your command for mistakes. See holesail --help`));
            process.exit(2);
        }

        if (args.filemanager && typeof (args.filemanager) !== 'boolean') {
            //check if the given path is correct
            const fs = require('fs');
            if (!fs.existsSync(args.filemanager)) {
                console.log(colors.red(`Error: Given path does not exist`));
                process.exit(2);
            }

        }

    }
}

module.exports = {ValidateInput};
