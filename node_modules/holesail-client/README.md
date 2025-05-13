
# Holesail Client

[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj)

The Holesail Client is a Node.js and Bare module for connecting to Holesail Servers with secure and efficient data relaying.

----------

## Installation

Install the Holesail Client module via npm:

```bash
npm install holesail-client
```

----------

## Usage

### Importing the Module

To use the module, require it in your project:

```javascript
const HolesailClient = require('holesail-client');
```

### Creating an Instance

Create a new instance of the `HolesailClient` class by passing your peer key:

```javascript
const client = new HolesailClient({ key: '<key>' });
```

#### Secure Mode

To avoid leaking access capability on the DHT, pass the optional "secure" flag. Ensure the server is also configured for secure mode:

```javascript
const client = new HolesailClient({ key: '<key>', secure: true });
```

### Connecting to the Server

Use the `connect` method to establish a connection to the Holesail Server, opts are auto detected but you can specify custom opts:

```javascript
client.connect({ port: 5000, host: '127.0.0.1', udp: true }, () => {
    console.log('Connected to the server');
});

```

### Destroying the Connection

To terminate the connection and clean up resources, call the `destroy` method:

```javascript
client.destroy();
```

----------
### Resuming and Pausing

You can also resume or pause the connection:

```javascript
await client.resume();
await client.pause();

```

----------

## Example

Here is a complete example demonstrating how to use the Holesail Client:

```javascript
const HolesailClient = require('holesail-client');

// Replace with your peer key
const client = new HolesailClient({ key: 'fwkkgncpatjpt5j6n53beqjoz7wtxtbse8d7u9z1y17esbz5dhpo' });

client.connect({ port: 8000, host: '127.0.0.1', udp: true }, () => {
    console.log('Connected to the server');
});

setTimeout(() => {
    console.log('Closing connection...');
    client.destroy();
}, 5000);


```

----------

## API Reference

### `new HolesailClient(opts)`

Creates a new instance of the `HolesailClient` class.

#### Parameters:
- opts (object): Options object:
  - key (string): A hexadecimal string representing your peer key.
  - secure (boolean, optional): Pass true to enable private connections. The server must also be running in secure mode. [See private vs public mode](https://docs.holesail.io/terminology/private-vs-public-connection-string)

----------

### `connect(options, callback)`

Establishes a connection to a Holesail Server.

#### Parameters:

-   `options` (object): Connection options:
    -   `port` (number): Port number of the server.
    -   `address` (string): IP address of the server (default: "127.0.0.1").
    -   `udp` (boolean, optional): Set to `true` for UDP connections.
-   `callback` (function): A function called once the connection is successfully established.

----------

### `destroy()`

Terminates the connection and releases associated resources.

### `resume()`

Resumes the connection if it was paused.

### `pause()`

Pauses the connection.

### `get(opts)`

Retrieves a mutable record stored on the DHT.

----------

### `client.info`

Provides information about the current state of the client, including:

- state: Current state of the client (e.g., 'listening', 'paused', 'destroyed').
- secure: Indicates whether the connection is private.
- port: Current port used for the connection.
- host: Current host used for the connection.
- protocol: Current protocol being used ('udp' or 'tcp').
- key: Connection key from the server.
- publicKey: The public key announced on DHT for discovery.

----------

## License

Holesail Client is released under the [GPL-v3 License](https://www.gnu.org/licenses/gpl-3.0.en.html).

For more details, see the [LICENSE](https://www.gnu.org/licenses/gpl-3.0.en.html) file.

----------

## Community and Support

Join our [Discord Support Server](https://discord.gg/TQVacE7Vnj) for help, discussions, and updates.
