# @hyperswarm/secret-stream

### [See the full API docs at docs.holepunch.to](https://docs.holepunch.to/building-blocks/hyperswarm#secretstream)

Secret stream backed by Noise and libsodium's secretstream

```
npm install @hyperswarm/secret-stream
```

## Usage

You can either make a secret stream from an existing transport stream.

``` js
const SecretStream = require('@hyperswarm/secret-stream')

const a = new SecretStream(true, tcpClientStream)
const b = new SecretStream(false, tcpServerStream)

// pipe the underlying rawstreams together

a.write(Buffer.from('hello encrypted!'))

b.on('data', function (data) {
  console.log(data) // <Buffer hello encrypted!>
})
```

Or by making your own pipeline

``` js
const a = new SecretStream(true)
const b = new SecretStream(false)

// pipe the underlying rawstreams together
a.rawStream.pipe(b.rawStream).pipe(a.rawStream)

a.write(Buffer.from('hello encrypted!'))

b.on('data', function (data) {
  console.log(data) // <Buffer hello encrypted!>
})
```

## API

#### `const s = new SecretStream(isInitiator, [rawStream], [options])`

Make a new stream. `isInitiator` is a boolean indication whether you are the client or the server.
`rawStream` can be set to an underlying transport stream you want to run the noise stream over.

Options include:

```js
{
  pattern: 'XX', // which noise pattern to use
  remotePublicKey, // set if your handshake requires it
  keyPair: { publicKey, secretKey },
  handshake: { // if you want to use an handshake performed elsewhere pass it here
    tx,
    rx,
    hash,
    publicKey,
    remotePublicKey
  },
  enableSend: true // (advanced) set false to disable the send API
}
```

The SecretStream returned is a Duplex stream that you use as as normal stream, to write/read data from,
except it's payloads are encrypted using the libsodium secretstream.

Note that this uses ed25519 for the handshakes per default.

If need to load the key pair asynchronously, then secret-stream also supports passing in a promise
instead of the keypair that later resolves to `{ publicKey, secretKey }`. The stream lifecycle will wait
for the resolution and auto destroy the stream if the promise errors.

#### `s.start(rawStream, [options])`

Start a SecretStream from a rawStream asynchrously.

``` js
const s = new SecretStream({
  autoStart: false // call start manually
})

// ... do async stuff or destroy the stream

s.start(rawStream, {
  ... options from above
})
```

#### `s.setTimeout(ms)`

Set the stream timeout. If no data is received within a `ms` window,
the stream is auto destroyed.

#### `s.setKeepAlive(ms)`

Send a heartbeat (empty message) every time the socket is idle for `ms` milliseconds. **Note:** If one side calls `s.setKeepAlive()` and the other does not, then the empty messages will be passed through to the piped stream.

#### `s.publicKey`

Get the local public key.

#### `s.remotePublicKey`

Get the remote's public key.
Populated after `open` is emitted.

#### `s.handshakeHash`

Get the unique hash of this handshake.
Populated after `open` is emitted.

#### `s.keepAlive`

Get the interval (in milliseconds) at which keep-alive messages are sent (0 means none are sent).

#### `s.sendKeepAlive()`

A convenience method that sends an empty message.

#### `s.rawBytesWritten`

The number of bytes (measured after encryption) written.

#### `s.rawBytesRead`

The number of bytes (measured before decryption) received.

#### `s.on('connect', onconnect)`

Emitted when the handshake is fully done.
It is safe to write to the stream immediately though, as data is buffered
internally before the handshake has been completed.

#### `await s.send(buffer)`
Sends an encrypted unordered message, see [udx-native](https://github.com/holepunchto/udx-native/tree/main?tab=readme-ov-file#await-streamsendbuffer) for details.  
This method with silently fail if called before handshake is complete or if the underlying rawStream is not an UDX-stream (not capable of UDP).

#### `s.trySend(buffer)`
Same as `send(buffer)` but does not return a promise.

#### `s.on('message', onmessage)`
Emmitted when an unordered message is received

#### `keyPair = SecretStream.keyPair([seed])`

Generate a ed25519 key pair.

## License

Apache-2.0
