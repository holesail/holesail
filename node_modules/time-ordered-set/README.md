# time-ordered-set

Efficiently maintain a set of nodes ordered by the time they were added to the set

```
npm install time-ordered-set
```

[![build status](http://img.shields.io/travis/mafintosh/time-ordered-set.svg?style=flat)](http://travis-ci.org/mafintosh/time-ordered-set)

## Usage

``` js
var set = require('time-ordered-set')
var s = set()

// add 3 nodes

s.add({
  hello: 'world'
})

var node = s.add({
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

#### `var s = set()`

Create a new set

#### `node = s.add(node)`

Add a new node to the set. Will add the properties `node.next` and `node.prev` to the node.
Re-adding the same node will move to the latest node.

#### `node = s.remove(node)`

Remove a node. Will set `node.next` and `node.prev` to `null`.

#### `bool = s.has(node)`

Check if a node has been added.

#### `var array = s.toArray(maxCount)`

Get an ordered array out of all the nodes, ordered from oldest to newest. Set `maxCount` if you only want to get a subset.

#### `s.oldest`

Property containing the oldest node.

#### `s.latest`

Property containing the newest node.

#### `s.length`

Property containing how many nodes are in the set.

## License

MIT
