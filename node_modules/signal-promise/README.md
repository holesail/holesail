# signal-promise

Simple wait/notify promise with optional max wait time

```
npm install signal-promise
```

## Usage

``` js
const Signal = require('signal-promise')

const input = new Signal()

while (await input.wait()) {
  console.log('someone typed!')
}

process.stdin.on('stdin', function () {
  input.notify()
})
```

## API

#### `s = new Signal()`

Make a new signal

#### `await s.wait([maxWaitTime])`

Wait for someone to call notify. If you specify `maxWaitTime`
the promise will resolve after `maxWaitTime` ms if no notify call has happened.

As a convenience the promise resolves to `true` so it's easy to use it as a condition.

#### `s.notify([error])`

Notify everyone waiting. If you pass an error the wait promise
will reject with that error.

## License

MIT
