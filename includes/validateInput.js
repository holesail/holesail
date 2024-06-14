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

        //server and client are not supported at the same time
        if (args.live && (args.connect || args['_'][0])) {
            console.log(colors.red("Error: You can't start a server and client at the same time. Kindly check and fix your inputs, see holesail --help"));
            process.exit(2);
        }

        //64 length string is considered a key not a connector
        if (args.connector && args.connector.length === 64) {
            console.log(colors.red("Error: Connectors can not be of length 64, any string with length 64 is considered a key, see holesail --help on how to use a connector"));
            process.exit(2);
        }


    }
}

module.exports = {ValidateInput};
