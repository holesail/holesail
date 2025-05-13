# udx-native

udx is reliable, multiplexed, and congestion-controlled streams over udp.

```
npm i udx-native
```

It's a transport protocol, made only for peer-to-peer networking.

No handshakes. No encryption. No features. This is good for P2P.\
Just fast streams and messages that are composable into powerful things.

## Usage

```js
const UDX = require('udx-native')

const u = new UDX()
const a = u.createSocket()
const b = u.createSocket()

b.on('message', function (message) {
  console.log('received', message.toString())
  a.close()
  b.close()
})

b.bind(0)
a.send(Buffer.from('hello'), b.address().port)
```

```js
const UDX = require('udx-native')

const u = new UDX()

const socket1 = u.createSocket()
const socket2 = u.createSocket()

socket1.bind()
socket2.bind()

const stream1 = u.createStream(1)
const stream2 = u.createStream(2)

stream1.connect(socket1, stream2.id, socket2.address().port, '127.0.0.1')
stream2.connect(socket2, stream1.id, socket1.address().port, '127.0.0.1')

stream1.write(Buffer.from('hello'))
stream1.end()

stream2.on('data', function (data) {
  console.log(data)
})

stream2.on('end', function () {
  stream2.end()
})

stream1.on('close', function () {
  console.log('stream1 closed')
  socket1.close()
})

stream2.on('close', function () {
  console.log('stream2 closed')
  socket2.close()
})
```

## API

#### `const udx = new UDX()`

Creates a new UDX instance.

#### `const bool = UDX.isIPv4(host)`

Returns `true` if host is an IPv4 address.

#### `const bool = UDX.isIPv6(host)`

Returns `true` if host is an IPv6 address.

#### `const family = UDX.isIP(host)`

Returns the address family (`4` or `6`). Returns `0` if invalid.

## Sockets

#### `const socket = udx.createSocket([options])`

Creates a new socket instance.

Available `options`:
```js
{
  ipv6Only: false,
  reuseAddress: false
}
```

#### `socket.udx`

It's the UDX instance from where the socket was created.

#### `socket.streams`

It's a `Set` that tracks active streams (connected to the socket but not closed).

#### `socket.userData`

Optional custom userData. Default is `null`.

#### `socket.bound`

Indicates if it's bound to any port. It will be `true` after a successful `bind()`.

#### `socket.closing`

It will be `true` after `close()` is called.

#### `socket.idle`

Indicates that the socket doesn't have any connected stream.

#### `socket.busy`

Indicates that the socket have at least one connected stream.

#### `socket.address()`

Returns an object like `{ host, family, port }`. Only available after `bind()`.

#### `socket.bind([port], [host])`

The default port is `0`.\
If no host specified: it binds to IPv6 `::`. If fails then IPv4 `0.0.0.0`.

#### `await socket.close()`

It unbinds the socket so it stops listening for messages.

#### `socket.setTTL(ttl)`

Sets the amount of times that a packet is allowed to be forwarded through each router or gateway before being discarded.

#### `socket.getRecvBufferSize()`
#### `socket.setRecvBufferSize()`

#### `socket.getSendBufferSize()`
#### `socket.setSendBufferSize()`

#### `await socket.send(buffer, port, [host], [ttl])`

Sends a message to port and host destination. Default host is `127.0.0.1`.

#### `socket.trySend(buffer, port, [host], [ttl])`

Same behaviour as `send()` but no promise.

#### `socket.on('message', (msg, from) => {})`

`msg` is a buffer that containts the message.\
`from` is an object like `{ host, family, port }`.

#### `socket.on('close', onclose)`

Emitted if the socket was ever bound and it got closed.

#### `socket.on('idle', onidle)`

Emitted if the socket becomes idle (no active streams).

#### `socket.on('busy', onbusy)`

Emitted if the socket becomes busy (at least one active stream).

#### `socket.on('listening', onlistening)`

Emitted after a succesfull `bind()` call.

## Streams

#### `const stream = udx.createStream(id, [options])`

Creates a new stream instance that is a Duplex stream.

Available `options`:
```js
{
  firewall: (socket, port, host) => true,
  framed: false,
  seq: 0
}
```

#### `stream.udx`

It's the UDX instance from where the stream was created.

#### `stream.socket`

Refers to the socket that is connected to. Setted when you `connect()` the stream.

#### `stream.id`

Custom stream id.

#### `stream.remoteId`

Remote stream id. Setted when you `connect()` the stream.

#### `stream.remoteId`

Remote stream id. Setted when you `connect()` the stream.

#### `stream.remoteHost`

Remote host. Setted when you `connect()` the stream.

#### `stream.remoteFamily`

Remote family (`4` or `6`). Setted when you `connect()` the stream.

#### `stream.remotePort`

Remote port. Setted when you `connect()` the stream.

#### `stream.userData`

Optional custom userData. Default is `null`.

#### `stream.connected`

Indicates if the stream is connected to a socket. It becomes `false` if the stream is closed.

#### `stream.mtu`

Indicates the maximum size of each packet.

#### `stream.rtt`
#### `stream.cwnd`
#### `stream.inflight`

#### `stream.localHost`

Indicates the connected socket host address. By default `null` if not connected.

#### `stream.localFamily`

Indicates the connected socket family address (`4` o `6`). By default `0` if not connected.

#### `stream.localPort`

Indicates the connected socket port. By default `0` if not connected.

#### `stream.setInteractive(bool)`

#### `stream.connect(socket, remoteId, port, [host], [options])`

Connects the stream using a socket to a: remote stream id, and remote socket port/host.

If no host specified it uses `127.0.0.1` by default.

Available `options`:
```js
{
  ack
}
```

#### `await stream.changeRemote(remoteId, port, [host])`

Change the remote end of the stream.

If no host specified it uses `127.0.0.1` by default.

#### `stream.relayTo(destination)`

Relay stream to another stream.

#### `await stream.send(buffer)`

Send a message to another stream. Returns a promise.

#### `stream.trySend(buffer)`

Send a message to another stream.

#### `const drained = await stream.flush()`

Wait for pending stream writes to have been explicitly acknowledged by the other side of the connection.

#### `stream.on('connect', onconnect)`

Emitted after the stream is connected to a socket.

#### `stream.on('message', onmessage)`

Emitted if the stream receives a message.

#### `stream.on('remote-changed', onremotechanged)`

Emitted when the remote end of the stream changes.

#### `stream.on('mtu-exceeded', onmtuexceeded)`

Emitted only once if you write data that exceeds the MTU.

## Network interfaces

#### `const interfaces = udx.networkInterfaces()`

Returns an array of network interfaces, for example:
```js
[
  { name: 'lo', host: '127.0.0.1', family: 4, internal: true },
  { name: 'enp4s0', host: '192.168.0.20', family: 4, internal: false },
  { name: 'lo', host: '::1', family: 6, internal: true },
  { name: 'enp4s0', host: 'df08::c8df:bf61:95c1:352b', family: 6, internal: false }
]
```

#### `const watcher = udx.watchNetworkInterfaces([onchange])`

Listens to changes in the network interfaces. The `watcher` object is iterable.

#### `watcher.interfaces`

Array of network interfaces.

#### `watcher.watch()`

Starts watching for changes. By default it already does it. This is only useful after you `unwatch()`.

#### `watcher.unwatch()`

Stops watching for changes.

#### `await watcher.destroy()`

Closes the watcher.

#### `watcher.on('change', onchange)`

Emitted after a network interface change.

#### `watcher.on('close', onclose)`

Emitted after the watcher is closed.

## DNS

#### `const address = await udx.lookup(host, [options])`

It does a DNS lookup for the IP address. Returns `{ host, family }`.

Available `options`:
```js
{
  family: 0 // => 0, 4 or 6
}
```

## Dev Setup

To develop UDX locally, you need to create a libudx prebuild. [bare-make](https://github.com/holepunchto/bare-make) is used for this.

Requirements: The Clang C-compiler should be installed.

The other setup steps are:

- `npm install -g bare-runtime bare-make`
- `npm install`
- `bare-make generate`
- `bare-make build`
- `bare-make install`

When testing changes, rebuild the prebuilds:

- `bare-make generate`
- `bare-make build`
- `bare-make install`


## License

Apache-2.0
