# holesail-server
[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj)

Create and announce your server on the HyperDHT P2P protocol.

## Installation
```shell
npm i holesail-server 
```
## Usage
Require as a module
```js
const HolesailServer = require('holesail-server')
```
Create instance of the holesailServer class
```js
const server =  new HolesailServer();
```
Start server and get the public key
```js
server.serve({port:5000, address:"127.0.0.1"}, () => {
    console.log('Server started');
    console.log(server.getPublicKey());
    setTimeout(() => {
      server1.destroy();
      console.log('Server destroyed');
  }, 6000);
})

```
Optionally you can also set a buffSeed to generate the same connection key every time
```js
server.serve({port:5000, address:"127.0.0.1",buffSeed:"4917816487c1822049939ff1abbf515663275105d01361bbc84fe2000e594539"}, () => {
    console.log('Server started');
    console.log(server.getPublicKey());
    setTimeout(() => {
      server1.destroy();
      console.log('Server destroyed');
  }, 6000);
})
//buffSeed needs to be of 64 char long
```

Destroy the DHT server

```
server.destroy();
```

### Syntax:
```
server.serve(options,callback())
```
#### Options:
- port: The port to listen on (required)
- address: The local address, use 0.0.0.0 if you want to listen on all (required)
- buffSeed: A 64 character long string, will be used as a buffer of the connector. Pass it if you want to use same connector everytime (Optional)
- secure: (boolean) (optional) (Recommended).  Prevents leaking access capability to HyperDHT. Listens on a different seed than the one needed to connect on.