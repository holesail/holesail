 # Holesail

[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj) [Join our Reddit Community](https://www.reddit.com/r/holesail/)

## Overview

Holesail lets you share any locally running application on a specific port with third parties securely and with a single command. No static IP or port forwarding required.

## Installation

Before using Holesail, make sure you have Node.js installed on your system. You can download Node.js from the official website: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)

Once Node.js is installed, you can install Holesail Server using npm (Node Package Manager):

```
npm i holesail -g
```

## Quick Usage

To start a local Holesail Server, use the following command:

```
holesail --live port
```
Replace `port` with the desired port number you want to expose to the network.

This will give you a connection string to connect to, use that to access this server from anywhere:

```
holesail <connection-string> 
```

## All commands

To view full usage instructions and all set of commands, run:
```
holesail --help
```

## Graceful Goodbye

Holesail Server includes graceful goodbye functionality, which ensures that the server is properly shut down when you close the terminal or interrupt the process.

## License

Holesail Server is released under the GPL-3.0 License. See the [LICENSE](https://www.gnu.org/licenses/gpl-3.0.en.html) file for more information.

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## Acknowledgments

Holesail is built using the following open-source projects:

- hypertele: https://github.com/bitfinexcom/hypertele
- holepunch: https://holepunch.to
- holesail-server: https://github.com/holesail/holesail-server)

and other node packages.
