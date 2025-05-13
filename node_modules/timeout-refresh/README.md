# timeout-refresh

Efficiently refresh a timer

```
npm install timeout-refresh
```

Uses `timeout.refresh` in Node.
In the browser a basic `clearTimeout + setTimeout` is used since no other method exists

## Usage

``` js
const Timeout = require('timeout-refresh')

const to = Timeout.once(100, function () {
  console.log('Timed out!')
})

const i = setInterval(function () {
  // refresh every 50ms
  to.refresh()
}, 50)

setTimeout(function () {
  // cancel the refresh after 500ms
  clearInterval(i)
  setTimeout(function () {
    console.log('Should have timed out now')
  }, 200)
}, 500)
```

## API

#### `to = Timeout.once(ms, ontimeout, [context])`

Make a new refreshable timeout that fires once.

If you pass `context`, it will be set as `this` when calling `ontimeout`.

#### `to = Timeout.on(ms, ontimeout, [context])`

Make a new refreshable timeout that fires every `ms`.

If you pass `context`, it will be set as `this` when calling `ontimeout`.

#### `to.unref()`

Unref the timer.

#### `to.ref()`

Ref the timer.

#### `to.refresh()`

Refresh the timeout.

#### `to.destroy()`

Destroy the timeout.

## License

MIT
