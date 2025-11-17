# Holesail

```
_   _       _                 _ _   _
| | | | ___ | | ___  ___  __ _(_) | (_) ___
| |_| |/ _ \| |/ _ \/ __|/ _` | | | | |/ _ \
|  _  | (_) | |  __/\__ \ (_| | | |_| | (_) |
|_| |_|\___/|_|\___||___/\__,_|_|_(_)_|\___/
```

[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj) [Join our Reddit Community](https://www.reddit.com/r/holesail/)

To support the development of this project:

Lightning BTC: linenbird5@primal.net
BTC Address: 183Pfn4fxuMJMSvZXdBdYsNKWSnWHCdBdA

## Overview

Holesail is a truly peer-to-peer network tunneling and reverse proxy software that supports both TCP and UDP protocols.

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
holesail --live <port>
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

## API

### Usage

```js
const Holesail = require('holesail')

const hs = new Holesail({
  server: true, // act as a server
  secure: true // use secure mode
})

await hs.ready()

console.log('Server is ready:', hs.info.url)
```

Or as a client:

```js
const Holesail = require('holesail')

const hs = new Holesail({
  client: true,
  key: 'hs://s000abcdef...' // URL or raw key
})

await hs.ready()

console.log('Client connected:', hs.info)
```

**API**

`new Holesail(opts)`

Options:

- server Boolean Start as server (default false)
- client Boolean Start as client (default false)
- key String Optional. URL or raw key for connecting
- secure Boolean Enable secure mode (default false)
- port Number Optional. Specific port to bind/connect
- host String Optional. Specific host to bind/connect
- udp Boolean Optional. Force UDP usage (advanced)

`.ready()`
Wait for Holesail to initialize and connect.

`.pause()`

`.resume()`

`.info()`
Get metadata about the current Holesail instance:

`.close()`
Gracefully shuts down the connection and releases resources.

## URL Format

Holesail uses a simple URL format for sharing server locations:

- Secure server: hs://s000<key>

- Insecure server: hs://0000<key>

The parser will auto-detect and split the prefix for you.
If you pass a full hs:// URL to the constructor, it'll Just Work

## Documentation

Documentation for Holesail can be found at https://docs.holesail.io/

## License

This project is licensed under the GNU AGPL v3 license — see the LICENSE
## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## Acknowledgments

Holesail is built on and inspired by following open-source projects:

- hypertele: https://github.com/bitfinexcom/hypertele
- holepunch: https://holepunch.to
