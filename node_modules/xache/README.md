# xache

Yet another auto expiring, max sizable cache

```
npm install xache
```

## Usage

``` js
const Xache = require('xache')

const cache = new Xache({
  maxSize: 10, // at max (ish) have 10 entries
  maxAge: 100, // auto expire entries after (ish) 100ms
  createMap () { // optional function to create backing storage
    return new Map()
  }
})

// When maxSize is hit, the oldest entries are removed
// cache has the same api as a map

cache.set('hello', 'world')
console.log(cache.get('hello'))

console.log(...cache) // iterable!
```

That's it, nice and simple.

## License

MIT
