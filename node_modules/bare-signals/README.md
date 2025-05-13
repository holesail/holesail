# bare-signals

Native signal handling for JavaScript.

```
npm i bare-signals
```

## Usage

```js
const Signal = require('bare-signals')

const sigint = new Signal('SIGINT')

sigint.on('signal', () => console.log('SIGINT caught')).start()
```

## License

Apache-2.0
