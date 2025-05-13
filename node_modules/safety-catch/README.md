# safety-catch

Small module that makes sure your catch, caught an actual error and not a programming mistake or assertion.

```
npm install safety-catch
```

Triggers an unhandled error in the next tick, when you pass it an SyntaxError, TypeError, AssertionError and other builtins.

## Usage

``` js
const safetyCatch = require('safety-catch')

try {
  foo.bar()
} catch (err) {
  // Was this a programming mistake and should you crash your program?
  // Ask the safety catch
  safetyCatch(err)

  console.log('Actual error')
}
```

## License

MIT
