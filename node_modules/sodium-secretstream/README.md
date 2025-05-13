# sodium-secretstream

Wraps libsodium's secretstream in a higher level abstraction

```
npm install sodium-secretstream
```

## Usage

``` js
const { Pull, Push, keygen } = require('sodium-secretstream')

const key = keygen()

// the sender
const push = new Push(key)

// the receiver
const pull = new Pull(key)

// send header to the other side
pull.init(push.header)

// send the cipher to the other side
const cipher1 = push.next(Buffer.from('test'))

// prints "test"
console.log(pull.next(cipher1))

// send the cipher to the other side
const cipher2 = push.next(Buffer.from('test 2'))

// prints "test 2"
console.log(pull.next(cipher2))

// when done send a final signal
const cipher3 = push.final()

// prints <empty buffer>
console.log(pull.next(cipher3))

// but sets pull.final to true
console.log(pull.final)
```

## License

MIT
