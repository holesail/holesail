# dht-rpc

Make RPC calls over a [Kademlia](https://pdos.csail.mit.edu/~petar/papers/maymounkov-kademlia-lncs.pdf) based DHT.

```
npm install dht-rpc
```

## Key Features

* Remote IP / firewall detection
* Easily add any command to your DHT
* Streaming queries and updates

Note that internally V5 of dht-rpc differs significantly from V4, due to a series
of improvements to NAT detection, secure routing IDs and more.

## Usage

Here is an example implementing a simple key value store

First spin up a bootstrap node. You can make multiple if you want for redundancy.
There is nothing special about a bootstrap node, except it needs to know it's own host and port,
since it knows no other nodes to infer it from.

``` js
import DHT from 'dht-rpc'

const bootstrap = DHT.bootstrapper(10001, '127.0.0.1')
```

Now lets make some dht nodes that can store values in our key value store.

``` js
import DHT from 'dht-rpc'
import crypto from 'crypto'

// Let's create 100 dht nodes for our example.
for (var i = 0; i < 100; i++) createNode()

function createNode () {
  const node = new DHT({
    bootstrap: [
      'localhost:10001'
    ]
  })

  const values = new Map()
  const VALUES = 0 // define a command enum

  node.on('request', function (req) {
    if (req.command === VALUES) {
      if (req.token) { // if we are the closest node store the value (ie the node sent a valid roundtrip token)
        const key = hash(req.value).toString('hex')
        values.set(key, req.value)
        console.log('Storing', key, '-->', req.value.toString())
        return req.reply(null)
      }

      const value = values.get(req.target.toString('hex'))
      req.reply(value)
    }
  })
}

function hash (value) {
  return crypto.createHash('sha256').update(value).digest()
}
```

To insert a value into this dht make another script that does this following

``` js
const node = new DHT()

const q = node.query({
  target: hash(val),
  command: VALUES,
  value
}, {
  // commit true will make the query re-request the 20 closest
  // nodes with a valid round trip token to update the values
  commit: true
})

await q.finished()
```

Then after inserting run this script to query for a value

``` js
const target = Buffer.from(hexFromAbove, 'hex')
for await (const data of node.query({ target, command: VALUES })) {
  if (data.value && hash(data.value).toString('hex') === hexFromAbove) {
    // We found the value! Destroy the query stream as there is no need to continue.
    console.log(val, '-->', data.value.toString())
    break
  }
}
console.log('(query finished)')
```

## API

#### `const node = new DHT([options])`

Create a new DHT node.

Options include:

``` js
{
  // A list of bootstrap nodes
  bootstrap: [ 'bootstrap-node.com:24242', ... ],
  // Optionally pass in array of { host, port } to add to the routing table if you know any peers
  nodes: [{ host, port }, ...],
  // Optionally pass a port you prefer to bind to instead of a random one
  port: 0,
  // Optionally pass a host you prefer to bind to instead of all networks
  host: '0.0.0.0',
  // Optionally pass a UDX instance on which sockets will be created.
  udx,
  // dht-rpc will automatically detect if you are firewalled. If you know that you are not set this to false
  firewalled: true
}
```

Nodes per default use something called adaptive mode to decide whether or not they want to join other nodes' routing table.
This includes things like node uptime, if the node is firewalled etc. Adaptive mode is conservative, so it might take ~20-30 mins for the node to turn persistent. If you are making a test case with your own bootstrap network you'd usually want to turn this off to make sure your test finishes in a timely maner. You can do this by passing `ephemeral: false` in the constructor.
For the vast majority of use-cases you should always use adaptive mode to ensure good DHT health, ie the defaults.

Your DHT routing id is `hash(publicIp + publicPort)` and will be autoconfigured internally.

#### `const node = DHT.bootstrapper(port, host, [options])`

Make a bootstrap node for your DHT. The port and host needs to be it's globally accessable port and host.
Note: `port` and `host` parameters are used to create the node id. Use `options.host` if you want to bind to i.e. 127.0.0.1.
DHT nodes can use any other DHT node to bootstrap, but a bootstrap node can bootstrap itself, by itself.

#### `await node.ready()`

Wait for the node to be fully bootstrapped etc.
You don't have to wait for this method, but can be useful during testing.

#### `node.id`

Get your own routing ID. Only available when the node is not ephemeral.

#### `node.ephemeral`

A boolean indicating if you are currently epheremal or not

#### `node.on('bootstrap')`

Emitted when the routing table is fully bootstrapped. Emitted as a conveinience.

#### `node.on('listening')`

Emitted when the underlying UDX socket is listening. Emitted as a conveinience.

#### `node.on('ready')`

Emitted when the node is fully bootstrapped etc.

#### `node.on('persistent')`

Emitted when the node is no longer in ephemeral mode.
All nodes start in ephemeral mode, as they figure out their NAT settings.
If you set `ephemeral: false` then this is emitted during the bootstrap phase, assuming
you are on an open NAT.

#### `node.on('wake-up')`

Emitted when the node has detected that the computer has gone to sleep. If this happens,
it will switch from persistent mode to ephemeral again.

#### `node.on('network-change', interfaces)`

Emitted when the network interfaces of the computer change.

#### `node.on('nat-update', (host, port) => {})`
Emitted when `node.host` or `node.port` were changed.

#### `node.on('close')`

Will be emitted after `node.destroy()` is completed.

#### `node.refresh()`

Refresh the routing table by looking up a random node in the background.
This is called internally periodically, but exposed in-case you want to force a refresh.

#### `node.host`

Get your node's public ip, inferred from other nodes in the DHT.
If the ip cannot be determined, this is set to `null`.

#### `node.port`

Get your node's public port, inferred from other nodes in the DHT.
If your node does not have a consistent port, this is set to 0.

#### `node.firewalled`

Boolean indicated if your node is behind a firewall.

This is auto detected by having other nodes trying to do a PING to you
without you contacting them first.

#### `node.randomized`

Boolean indicating if your node is likely behind a randomizing NAT.

#### `const addr = node.address()`

Get the local address of the UDP socket bound.

Note that if you are in ephemeral mode, this will return a different
port than the one you provided in the constructor (under `port`), as ephemeral
mode always uses a random port.

#### `node.on('request', req)`

Emitted when an incoming DHT request is received. This is where you can add your own RPC methods.

* `req.target` - the dht target the peer is looking (routing is handled behind the scene)
* `req.command` - the RPC command enum
* `req.value` - the RPC value buffer
* `req.token` - If the remote peer echoed back a valid roundtrip token, proving their "from address" this is set
* `req.from` - who sent this request (host, port)

To reply to a request use the `req.reply(value)` method and to reply with an error code use `req.error(errorCode)`.

In general error codes are up to the user to define, with the general suggestion to start application specific errors
from error code `16` and up, to avoid future clashes with `dht-rpc` internals.

Currently dht-rpc defines the following errors

``` js
DHT.OK = 0 // ie no error
DHT.ERROR_UNKNOWN_COMMAND = 1 // the command requested does not exist
DHT.ERROR_INVALID_TOKEN = 2 // the round trip token sent is invalid
```

#### `reply = await node.request({ token, target, command, value }, to, [options])`

Send a request to a specific node specified by the to address (`{ host, port }`).
See the query API for more info on the arguments.

Options include:

```js
{
  retry: true, // whether the request should retry on timeout
  socket: udxSocket // request on this specific socket
}
```

Normally you'd set the token when commiting to the dht in the query's commit hook.

#### `reply = await node.ping(to, [options])`

Sugar for `dht.request({ command: 'ping' }, to, options)`

Additional options include:

```js
{
  size: 0, // size of the value buffer, filled with zeroes
}
```

#### `stream = node.query({ target, command, value }, [options])`

Query the DHT. Will move as close as possible to the `target` provided, which should be a 32-byte uniformly distributed buffer (ie a hash).

* `target` - find nodes close to this (should be a 32 byte buffer like a hash)
* `command` - an enum (uint) indicating the method you want to invoke
* `value` - optional binary payload to send with it

If you want to modify state stored in the dht, you can use the commit flag to signal the closest
nodes.

``` js
{
  // "commit" the query to the 20 closest nodes so they can modify/update their state
  commit: true
}
```

Commiting a query will just re-request your command to the closest nodes once those are verified.
If you want to do some more specific logic with the closest nodes you can specify a function instead,
that is called for each close reply.

``` js
{
  async commit (reply, dht, query) {
    // normally you'd send back the roundtrip token here, to prove to the remote that you own
    // your ip/port
    await dht.request({ token: reply.token, target, command, value }, reply.from)
  }
}
```

Other options include:

``` js
{
  nodes: [
    // start the query by querying these nodes
    // useful if you are re-doing a query from a set of closest nodes.
  ],
  replies: [
    // similar to nodes, but useful if you have an array of closest replies instead
    // from a previous query.
  ],
  map (reply) {
    // map the reply into what you want returned on the stram
    return { onlyValue: reply.value }
  }
}
```

The query method returns a stream encapsulating the query, that is also an async iterator. Each `data` event contain a DHT reply.
If you just want to wait for the query to finish, you can use the `await stream.finished()` helper. After completion the closest
nodes are stored in `stream.closestNodes` array.

If you want to access the closest replies to your provided target you can see those at `stream.closestReplies`.

#### `stream = node.findNode(target, [options])`

Find the node closest to the node with id `target`. Returns a stream encapsulating the query (see `node.query()`). `options` are the same as `node.query()`.

#### `node.destroy()`

Shutdown the DHT node.

#### `node.destroyed`

Boolean indicating if this has been destroyed.

#### `node.toArray()`

Get the routing table peers out as an array of `{ host, port }`

#### `node.addNode({ host, port })`

Manually add a node to the routing table.

#### `await node.suspend()`

Tell the DHT you are going to background (ie suspend and allow it to make preperations for that)

#### `await node.resume()`

Tell the DHT you are resuming from suspension.

## License

MIT
