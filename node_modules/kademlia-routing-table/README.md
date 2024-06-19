# kademlia-routing-table

XOR distance based routing table used for P2P networks such as a Kademlia DHT.

```
npm install kademlia-routing-table
```

Similar to k-buckets, but implemented using the simplifications described in https://github.com/ethereum/wiki/wiki/Kademlia-Peer-Selection

To understand the concept behind peer routing, DHTs, and the terms used here,
I recommend reading the [Kademlia DHT paper](https://pdos.csail.mit.edu/~petar/papers/maymounkov-kademlia-lncs.pdf) as well.

## Usage

``` js
const RoutingTable = require('kademlia-routing-table')
const { randomBytes } = require('crypto')

// Create a new table that stores nodes "close" to the passed in id.
// The id should be uniformily distributed, ie a hash, random bytes etc.
const table = new RoutingTable(randomBytes(32))

// Add a node to the routing table
table.add({
  id: randomBytes(32), // this field is required
  // populate with any other data you want to store
})

table.on('row', function (row) {
  // A new row has been added to the routing table
  // This row represents row.index similar bits to the table.id

  row.on('full', function (node) {
    // The row is full and cannot be split, so node cannot be added.
    // If any of the nodes in the row are "worse", based on
    // some application specific metric then we should remove
    // the worst node from the row and re-add the node.
  })
})

// Get the 20 nodes "closest" to a passed in id
const closest = table.closest(randomBytes(32), 20)
```

## API

#### `table = new RoutingTable(id, [options])`

Create a new routing table.

`id` should be a Buffer that is uniformily distributed. `options` include:

``` js
{
  k: 20 // The max row size
}
```

#### `bool = table.add(node)`

Insert a new node. `node.id` must be a Buffer of same length as `table.id`.
When inserting a node the XOR distance between the node and the table.id is
calculated and used to figure which table row this node should be inserted into.

Returns `true` if the node could be added to the corresponding row or `false` if not.
If `false` is returned the onfullrow function is invoked for the corresponding row and node.

#### `node = table.get(id)`

Get a node from the table using its id. Returns `null` if no node has the passed in `id`.

#### `bool = table.has(id)`

Returns `true` if a node exists for the passed in `id` and `false` otherwise.

#### `nodes = table.closest(id, [maxNodes])`

Returns an array of the closest (in XOR distance) nodes to the passed in id.

`id` should be Buffer of same length as `table.id`. Per default at max `k`
nodes are returned, but this can be configured using the `maxNodes` argument.

This method is normally used in a routing context, i.e. figuring out which nodes
in a DHT should store a value based on its id.

#### `bool = table.remove(id)`

Remove a node using its id. Returns `true` if a node existed for the id and
was removed and `false` otherwise.

#### `node = table.random()`

Get a random node from the table.

#### `nodes = table.toArray()`

Returns all nodes from table as an array. If you create a new routing table
from these nodes it will be identical to the used here.

#### `table.on('row', row)`

Emitted when a new row is added to the routing table. At max, `bitLength(table.id)`
will exist.

#### `table.rows`

A fixed size array of all rows in the table. Normally you would not need to worry
about accessing rows directly outside the row event.

## Row API

For the row passed in the the `onfullrow` function the following API exists.

#### `row.index`

The row index. Represents how many prefix bits are shared between nodes in the row
and the table id.

#### `row.nodes`

A list of all the nodes in the row, sorted by their `id`.

#### `row.data`

Property set to null initially you can use if you want to store optional data on the row.

#### `bool = row.add(node)`

Same as `table.add` but for a specific row. Only use this to add the `newNode`
passed in `onfullrow` function.

#### `bool = row.remove(node)`

Same as `table.remove` but for a specific row. Only use this to remove the
"worst" node from the row when wanting to add the newNode.

#### `row.on('add', node)`

Emitted when a new node is added to this row.

#### `row.on('remove', node)`

Emitted when a node has been removed from this row.

#### `row.on('full', node)`

Emitted when a node wants to be added to this row, but the row is full (stores `k` nodes).

When this happens you should check if any of the nodes already in the row (`row.nodes`) are
"worse" than the passed node. If that is the case, remove the "worst" one and re-add the node passed in the arguments.

Various algorithms can be implemented to handle full rows, which is why the routing table leaves most of this logic
up to the user. These kind of algorithms include adding the rejected node to a cache and wait for another node in the
row to be removed before trying to insert it again, or using an LRU cache to determine which node already in the row
has been heard from yet.

## License

MIT
