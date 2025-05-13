# hypercore-crypto

The crypto primitives used in hypercore, extracted into a separate module

```
npm install hypercore-crypto
```

## Usage

``` js
const crypto = require('hypercore-crypto')

const keyPair = crypto.keyPair()
console.log(keyPair) // prints a ed25519 keypair
```

## API

#### `keyPair = crypto.keyPair()`

Returns an `ED25519` keypair that can used for tree signing.

#### `signature = crypto.sign(message, secretKey)`

Signs a message (buffer).

#### `verified = crypto.verify(message, signature, publicKey)`

Verifies a signature for a message.

#### `hash = crypto.data(data)`

Hashes a leaf node in a merkle tree.

#### `hash = crypto.parent(left, right)`

Hash a parent node in a merkle tree. `left` and `right` should look like this:

```js
{
  index: treeIndex,
  hash: hashOfThisNode,
  size: byteSizeOfThisTree
}
```

#### `hash = crypto.tree(peaks)`

Hashes the merkle root of the tree. `peaks` should be an array of the peaks of the tree and should look like above.

#### `buffer = crypto.randomBytes(size)`

Returns a buffer containing random bytes of size `size`.

#### `hash = crypto.discoveryKey(publicKey)`

Return a hash derived from a `publicKey` that can used for discovery
without disclosing the public key.

#### `list = crypto.namespace(name, count)`

Make a list of namespaces from a specific publicly known name.
Use this to namespace capabilities or hashes / signatures across algorithms.

## License

MIT
