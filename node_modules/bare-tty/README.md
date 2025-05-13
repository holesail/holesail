# bare-tty

Native TTY streams for JavaScript.

```
npm i bare-tty
```

## Usage

```js
const tty = require('bare-tty')

const stdout = new tty.WriteStream(1)

stdout.write('Hello world!\n')
```

## License

Apache-2.0
