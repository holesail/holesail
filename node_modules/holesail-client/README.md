 # Holesail Client
[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj)

Connect to other peers running holesail-server. This client can connect to servers and relay the data on your system locally. It is supposed to be used as a Node.js module.


## Installation

To install the Holesail Client module, use npm:

```
npm install holesail-client
```

## Usage

To use the Holesail Client module, first require the module in your code:

```javascript
const holesailClient = require('holesail-client');
```

Then, create a new instance of the `holesailClient` class:

```javascript
const test = new holesailClient("ff14220e8155f8cd2bbeb2f6f2c3b7ed0212023449bc64b9435ec18c46b8de7f");
```
**If you are connecting securely you need to pass the "secure" flag [Optional but recommended]**
```javascript
const test = new holesailClient("ff14220e8155f8cd2bbeb2f6f2c3b7ed0212023449bc64b9435ec18c46b8de7f","secure");
```

You can connect to [holesail-server](https://github.com/holesail/holesail-server/) network by calling the `connect` method:

```javascript
test.connect({port:5000, address:"127.0.0.1"}, () => {
    console.log("Listening on 127.0.0.1:5000")
});
```


Once you're done using the client, you can destroy the connection to the DHT network by calling the `destroy` method:

```javascript
test.destroy();
```

## Example

Here's a simple example of how to use the Holesail Client module:

```javascript
const holesailClient = require('holesail-client');
let test = new holesailClient("ff14220e8155f8cd2bbeb2f6f2c3b7ed0212023449bc64b9435ec18c46b8de7f");

test.connect({port:8000, address:"127.0.0.1"}, () => {
        console.log("Connected")
    }
)

setTimeout(() => {
    console.log(test.destroy())
}, 5000);

```

## API

### `new holesailClient(key)`

Create a new instance of the `holesailClient` class. The `key` parameter is a hexadecimal string representing the peer's key.

For connecting securely you should pass a secure parameter, the server also needs to be running securely:
```angular2html
new holesailClient(key,"secure")
```

### `connect(options,callback)`

Connect to the DHT network. The `port` parameter is the port number to connect to, and the `address` parameter is the IP address of the target host.
#### options: {port:PORT, address:"address"}

### `destroy()`

Destroy the connection to the DHT network.

## License

This module is released under the GPL-v3 License. See the [LICENSE](https://www.gnu.org/licenses/gpl-3.0.en.html) file for more information.