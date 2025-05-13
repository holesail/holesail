# Holesail Server

[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj)

Holesail Server enables you to reverse proxy any local server peer-to-peer (P2P) using HyperDHT, no signalling server
required.

----------

Note: V2 has breaking changes, V2 is not compatible with V1 and will break infuture.

## Installation

Install the Holesail Server module via npm:

```bash
npm install holesail-server
```

----------

## Usage

### Importing the Module

Require the module in your project:

```javascript
const HolesailServer = require('holesail-server');
```

### Creating an Instance

Create a new instance of the `HolesailServer` class:

```javascript
const server = new HolesailServer();
```

### Starting the Server

Start the server using the `start` method and retrieve its public key:

```javascript
await server.start({ port: 5000, host: "127.0.0.1" }, () => {
  console.log("Server started");
  console.log(server.key);

  setTimeout(() => {
    server.destroy();
    console.log("Server destroyed");
  }, 6000);
});

```

### Using a Fixed Connection Key

Optionally, you can set a `seed` to ensure the server generates the same connection key every time:

```javascript
await server.start({
  port: 5000,
  host: "127.0.0.1",
  seed: "4917816487c1822049939ff1abbf515663275105d01361bbc84fe2000e594539"
}, () => {
  console.log("Server started");
  console.log(server.key);

  setTimeout(async () => {
    await server.destroy();
    console.log("Server destroyed");
  }, 6000);
});

// Note: seed must be a 64-character long string.

```

### Destroying the Server

Use the `destroy` method to stop the server and clean up resources:

```javascript
await server.destroy();
```

----------

## API Reference

### `await server.start(options, callback)`

Starts the server

#### Parameters:

- `options` (object):

    - `port` (number, required): The port to listen on.
    - `host` (string, required): The local address to bind to. Use `"0.0.0.0"` to listen on all interfaces.
    - `seed` (string, optional): A 64-character string used to generate a consistent connection key.
    - `secure` (boolean, optional, recommended): Prevents leaking access capability to HyperDHT by listening on a
      different seed than the one needed to connect.
    - `udp` (boolean, optional): Enables UDP instead of TCP connections.
- `callback` (function): A function that is called when the server successfully starts.

----------

### `server.key`

Retrieves the server's connection key. Use this key to connect to the server from a client.

----------

### `server.pause()`

Pause the server.

----------

### `server.resume()`

Resume the server.

----------

### `server.info`

Returns an object containing server information.

----------

### `await server.destroy()`

Stops the server and cleans up resources.

----------

### `await put(data)`
Put a mutable record on DHT. Max size 1 KB

----------

## License

Holesail Server is released under the [GPL-v3 License](https://www.gnu.org/licenses/gpl-3.0.en.html).

For more details, see the [LICENSE](https://www.gnu.org/licenses/gpl-3.0.en.html) file.

----------

## Community and Support

Join our [Discord Support Server](https://discord.gg/TQVacE7Vnj) for help, discussions, and updates.
