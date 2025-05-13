# protomux

Multiplex multiple message oriented protocols over a stream

```
npm install protomux
```

## Usage

``` js
const Protomux = require('protomux')
const c = require('compact-encoding')

// By framed stream, it has be a stream that preserves the messages, ie something that length prefixes
// like @hyperswarm/secret-stream

const mux = new Protomux(aStreamThatFrames)

// Now add some protocol channels

const cool = mux.createChannel({
  protocol: 'cool-protocol',
  id: Buffer.from('optional binary id'),
  onopen () {
    console.log('the other side opened this protocol!')
  },
  onclose () {
    console.log('either side closed the protocol')
  }
})

// And add some messages

const one = cool.addMessage({
  encoding: c.string,
  onmessage (m) {
    console.log('recv message (1)', m)
  }
})

const two = cool.addMessage({
  encoding: c.bool,
  onmessage (m) {
    console.log('recv message (2)', m)
  }
})

// open the channel

cool.open()

// And send some data

one.send('a string')
two.send(true)
```

## API

#### `mux = new Protomux(stream, [options])`

Make a new instance. `stream` should be a framed stream, preserving the messages written.

Options include:

``` js
{
  // Called when the muxer wants to allocate a message that is written, defaults to Buffer.allocUnsafe.
  alloc (size) {}
}
```

#### `mux = Protomux.from(stream | muxer, [options])`

Helper to accept either an existing muxer instance or a stream (which creates a new one).

#### `const channel = mux.createChannel(opts)`

Add a new protocol channel.

Options include:

``` js
{
  // Used to match the protocol
  protocol: 'name of the protocol',
  // Optional additional binary id to identify this channel
  id: buffer,
  // Optional encoding for a handshake
  handshake: encoding,
  // Optional array of messages types you want to send/receive.
  messages: [],
  // Called when the remote side adds this protocol.
  // Errors here are caught and forwared to stream.destroy
  async onopen (handshake) {},
  // Called when the channel closes - ie the remote side closes or rejects this protocol or we closed it.
  // Errors here are caught and forwared to stream.destroy
  async onclose () {},
  // Called after onclose when all pending promises has resolved.
  async ondestroy () {}
}
```

Sessions are paired based on a queue, so the first remote channel with the same `protocol` and `id`.

__NOTE__: `mux.createChannel` returns `null` if the channel should not be opened, ie it's a duplicate channel or the remote has already closed this one.

If you want multiple sessions with the same `protocol` and `id`, set `unique: false` as an option.

#### `const opened = mux.opened({ protocol, id })`

Boolean that indicates if the channel is opened.

#### `mux.pair({ protocol, id }, callback)`

Register a callback to be called everytime a new channel is requested.

#### `mux.unpair({ protocol, id })`

Unregisters the pair callback.

#### `channel.open([handshake])`

Open the channel.

#### `const m = channel.addMessage(opts)`

Add/register a message type for a certain encoding. Options include:

``` js
{
  // compact-encoding specifying how to encode/decode this message
  encoding: c.binary,
  // Called when the remote side sends a message.
  // Errors here are caught and forwared to stream.destroy
  async onmessage (message) { }
}
```

#### `m.send(data)`

Send a message.

#### `m.onmessage`

Function that is called when a message arrives.

#### `m.encoding`

The encoding for this message.

#### `channel.close()`

Closes the protocol channel.

#### `channel.cork()`

Corking the protocol channel, makes it buffer messages and send them all in a batch when it uncorks.

#### `channel.uncork()`

Uncork and send the batch.

#### `mux.cork()`

Same as `channel.cork` but on the muxer instance.

#### `mux.uncork()`

Same as `channel.uncork` but on the muxer instance.

#### `for (const channel of muxer) { ... }`

The muxer instance is iterable, so you can iterate over all the channels.

#### `mux.isIdle()`

Convenience method that returns true if the number of channels is currently 0.

## License

MIT
