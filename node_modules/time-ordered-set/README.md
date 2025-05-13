# time-ordered-set

Efficiently maintain a set of nodes ordered by the time they were added to the set

```
npm install time-ordered-set
```

## Usage

``` js
const TOS = require('time-ordered-set')
const s = new TOS()

// add 3 nodes

s.add({
  hello: 'world'
})

const node = s.add({
  hello: 'welt'
})

s.add({
  hello: 'verden'
})

// re-add the 2nd one

s.add(node)
console.log(s.toArray().map(node => node.hello)) // ['world', 'verden', 'welt']
```

## API

#### `const s = new TOS()`

Create a new set

#### `node = s.add(node)`

Add a new node to the set. Will add the properties `node.next` and `node.prev` to the node.
Re-adding the same node will move to the latest node.

#### `node = s.remove(node)`

Remove a node. Will set `node.next` and `node.prev` to `null`.

#### `bool = s.has(node)`

Check if a node has been added.

#### `const array = s.toArray([options])`

Get an ordered array out of all the nodes, ordered from oldest to newest. Use `options.reverse: true` to get from newest to oldest. Set `options.limit: number` if you only want to get a subset.

#### `s.oldest`

Property containing the oldest node.

#### `s.latest`

Property containing the newest node.

#### `s.length`

Property containing how many nodes are in the set.

## License

MIT
