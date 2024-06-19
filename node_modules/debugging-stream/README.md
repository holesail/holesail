# debugging-stream

Stream that helps you debug streams

```
npm install debugging-stream
```

## Usage

``` js
const DebuggingStream = require('debugging-stream')

const s = new DebuggingStream(anotherStream, {
  latency: [100, 200] // add between 100-200ms read latency,
})

// s is a duplex stream like any other
```

## License

MIT
