# bare-ansi-escapes

Parse and produce ANSI escape sequences.

```
npm i bare-ansi-escapes
```

## Usage

```js
const KeyDecoder = require('bare-ansi-escapes/key-decoder')

readableStream.pipe(new KeyDecoder()).on('data', (key) => console.log(key))
```

## License

Apache-2.0
