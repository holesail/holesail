# ready-resource

Modern single resource management

```
npm install ready-resource
```

## Usage

``` js
const ReadyResource = require('ready-resource')

class Thing extends ReadyResource {
  constructor () {
    super()
  }

  async _open () {
    // open the resource
  }

  async _close () {
    // close the resource
  }
}

const r = new Thing()

await r.ready() // calls _open once
await r.ready() // noop

await r.close() // calls _close after _open has finished
await r.close() // noop
```

## License

MIT
