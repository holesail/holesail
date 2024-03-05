 # Holesail
##Note: This package is Under development at the moment
## Overview

Holesail is a simple and flexible solution for creating a distributed hash table (DHT) server. It allows you to expose your local port to the network, making it accessible to other nodes.

## Installation

Before using Holesail, make sure you have Node.js installed on your system. You can download Node.js from the official website: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)

Once Node.js is installed, you can install Holesail Server using npm (Node Package Manager):

```
npm i holesail -g
```

## Usage

To start a local Holesail Server, use the following command:

```
holesail --live port
```

Replace `port` with the desired port number you want to expose to the network.

### Example

To start a local Holesail Server on port 8080, use the following command:

```
holesail --live 8080
```

## Help

If you need help or want to see the usage instructions, use the following command:

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

and other node packges.
