# compact-encoding-bitfield

[compact-encoding](https://github.com/compact-encoding/compact-encoding) codec for bitfields. Uses a variable length encoding that is ABI compatible with `cenc.uint`.

```sh
npm install compact-encoding-bitfield
```

## Usage

```js
const cenc = require('compact-encoding')
const bitfield = require('compact-encoding-bitfield')

const buffer = cenc.encode(bitfield(8), 0b1110_1011)
// <Buffer fd eb 00>

cenc.decode(bitfield(8), buffer)
// <Buffer eb>
```

Bitfields are represented as buffers. For each byte, the least significant bit denotes the first bit and the most significant bit denotes the last bit. For example, bit `0` will be the least significant bit of the first byte and bit `15` will be the most significant bit of the second byte.

The encoding will convert numbers to buffers. Buffers may also be passed directly and will be returned on decode.

## ABI

Depending on `length`, the bitfield is stored using a variable number of bytes:

1. `length < 8`: 1 byte with no prefix.
2. `length <= 16`: 2 bytes with a `0xfd` prefix.
3. `length <= 32`: 4 bytes with a `0xfe` prefix.
4. `length <= 64`: 8 bytes with a `0xff` prefix.

`length` must not exceed 64 bits.

## License

ISC
