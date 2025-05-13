# unslab

Unslab some slab'ed buffers

```
npm install unslab
```

## Usage

``` js
const unslab = require('unslab')

// the buf returned unpools the buffer passed from the memory slab
const buf = unslab(Buffer.from('hello world'))

// can do multiple at the same time if you use them together. only does a single alloc in this case
const [a, b] = unslab([Buffer.from('hello'), Buffer.from('world')])
```

## License

Apache-2.0
