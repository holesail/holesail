# compact-encoding

A series of compact encoding schemes for building small and fast parsers and serializers

```
npm install compact-encoding
```

## Usage

``` js
const cenc = require('compact-encoding')

const state = cenc.state()

// use preencode to figure out how big a buffer is needed
cenc.uint.preencode(state, 42)
cenc.string.preencode(state, 'hi')

console.log(state) // { start: 0, end: 4, buffer: null, cache: null }

state.buffer = Buffer.allocUnsafe(state.end)

// then use encode to actually encode it to the buffer
cenc.uint.encode(state, 42)
cenc.string.encode(state, 'hi')

// to decode it simply use decode instead

state.start = 0
cenc.uint.decode(state) // 42
cenc.string.decode(state) // 'hi'
```

## Encoder API

#### `state`

Should be an object that looks like this `{ start, end, buffer, cache }`.

You can also get a blank state object using `cenc.state()`.

* `start` is the byte offset to start encoding/decoding at.
* `end` is the byte offset indicating the end of the buffer.
* `buffer` should be either a Node.js Buffer or Uint8Array.
* `cache` is used internally be codecs, starts out as `null`.

#### `enc.preencode(state, val)`

Does a fast preencode dry-run that only sets state.end.
Use this to figure out how big of a buffer you need.

#### `enc.encode(state, val)`

Encodes `val` into `state.buffer` at position `state.start`.
Updates `state.start` to point after the encoded value when done.

#### `val = enc.decode(state)`

Decodes a value from `state.buffer` as position `state.start`.
Updates `state.start` to point after the decoded value when done in the buffer.

## Helpers

If you are just encoding to a buffer or decoding from one you can use the `encode` and `decode` helpers
to reduce your boilerplate

``` js
const buf = cenc.encode(cenc.bool, true)
const bool = cenc.decode(cenc.bool, buf)
```

## Bundled encodings

The following encodings are bundled as they are primitives that can be used
to build others on top. Feel free to PR more that are missing.

* `cenc.raw` - Pass through encodes a buffer, i.e. a basic copy.
* `cenc.uint` - Encodes a uint using [compact-uint](https://github.com/mafintosh/compact-uint).
* `cenc.uint8` - Encodes a fixed size uint8.
* `cenc.uint16` - Encodes a fixed size uint16. Useful for things like ports.
* `cenc.uint24` - Encodes a fixed size uint24. Useful for message framing.
* `cenc.uint32` - Encodes a fixed size uint32. Useful for very large message framing.
* `cenc.uint40` - Encodes a fixed size uint40.
* `cenc.uint48` - Encodes a fixed size uint48.
* `cenc.uint56` - Encodes a fixed size uint56.
* `cenc.uint64` - Encodes a fixed size uint64.
* `cenc.int` - Encodes an int using `cenc.uint` with ZigZag encoding.
* `cenc.int8` - Encodes a fixed size int8 using `cenc.uint8` with ZigZag encoding.
* `cenc.int16` - Encodes a fixed size int16 using `cenc.uint16` with ZigZag encoding.
* `cenc.int24` - Encodes a fixed size int24 using `cenc.uint24` with ZigZag encoding.
* `cenc.int32` - Encodes a fixed size int32 using `cenc.uint32` with ZigZag encoding.
* `cenc.int40` - Encodes a fixed size int40 using `cenc.uint40` with ZigZag encoding.
* `cenc.int48` - Encodes a fixed size int48 using `cenc.uint48` with ZigZag encoding.
* `cenc.int56` - Encodes a fixed size int56 using `cenc.uint56` with ZigZag encoding.
* `cenc.int64` - Encodes a fixed size int64 using `cenc.uint64` with ZigZag encoding.
* `cenc.biguint64` - Encodes a fixed size biguint64.
* `cenc.bigint64` - Encodes a fixed size bigint64 using `cenc.biguint64` with ZigZag encoding.
* `cenc.biguint` - Encodes a biguint with its word count uint prefixed.
* `cenc.bigint` - Encodes a bigint using `cenc.biguint` with ZigZag encoding.
* `cenc.float32` - Encodes a fixed size float32.
* `cenc.float64` - Encodes a fixed size float64.
* `cenc.buffer` - Encodes a buffer with its length uint prefixed. When decoding an empty buffer, `null` is returned.
* `cenc.raw.buffer` - Encodes a buffer without a length prefixed.
* `cenc.arraybuffer` - Encodes an arraybuffer with its length uint prefixed.
* `cenc.raw.arraybuffer` - Encodes an arraybuffer without a length prefixed.
* `cenc.uint8array` - Encodes a uint8array with its element length uint prefixed.
* `cenc.raw.uint8array` - Encodes a uint8array without a length prefixed.
* `cenc.uint16array` - Encodes a uint16array with its element length uint prefixed.
* `cenc.raw.uint16array` - Encodes a uint16array without a length prefixed.
* `cenc.uint32array` - Encodes a uint32array with its element length uint prefixed.
* `cenc.raw.uint32array` - Encodes a uint32array without a length prefixed.
* `cenc.int8array` - Encodes a int8array with its element length uint prefixed.
* `cenc.raw.int8array` - Encodes a int8array without a length prefixed.
* `cenc.int16array` - Encodes a int16array with its element length uint prefixed.
* `cenc.raw.int16array` - Encodes a int16array without a length prefixed.
* `cenc.int32array` - Encodes a int32array with its element length uint prefixed.
* `cenc.raw.int32array` - Encodes a int32array without a length prefixed.
* `cenc.biguint64array` - Encodes a biguint64array with its element length uint prefixed.
* `cenc.raw.biguint64array` - Encodes a biguint64array without a length prefixed.
* `cenc.bigint64array` - Encodes a bigint64array with its element length uint prefixed.
* `cenc.raw.bigint64array` - Encodes a bigint64array without a length prefixed.
* `cenc.float32array` - Encodes a float32array with its element length uint prefixed.
* `cenc.raw.float32array` - Encodes a float32array without a length prefixed.
* `cenc.float64array` - Encodes a float64array with its element length uint prefixed.
* `cenc.raw.float64array` - Encodes a float64array without a length prefixed.
* `cenc.bool` - Encodes a boolean as 1 or 0.
* `cenc.string`, `cenc.utf8` - Encodes a utf-8 string, similar to buffer.
* `cenc.raw.string`, `cenc.raw.utf8` - Encodes a utf-8 string without a length prefixed.
* `cenc.string.fixed(n)`, `cenc.utf8.fixed(n)` - Encodes a fixed sized utf-8 string.
* `cenc.ascii` - Encodes an ascii string.
* `cenc.raw.ascii` - Encodes an ascii string without a length prefixed.
* `cenc.ascii.fixed(n)` - Encodes a fixed size ascii string.
* `cenc.hex` - Encodes a hex string.
* `cenc.raw.hex` - Encodes a hex string without a length prefixed.
* `cenc.hex.fixed(n)` - Encodes a fixed size hex string.
* `cenc.base64` - Encodes a base64 string.
* `cenc.raw.base64` - Encodes a base64 string without a length prefixed.
* `cenc.base64.fixed(n)` - Encodes a fixed size base64 string.
* `cenc.utf16le`, `cenc.ucs2` - Encodes a utf16le string.
* `cenc.raw.utf16le`, `cenc.raw.ucs2` - Encodes a utf16le string without a length prefixed.
* `cenc.utf16le.fixed(n)`, `cenc.ucs2.fixed(n)` - Encodes a fixed size utf16le string.
* `cenc.fixed32` - Encodes a fixed 32 byte buffer.
* `cenc.fixed64` - Encodes a fixed 64 byte buffer.
* `cenc.fixed(n)` - Makes a fixed sized encoder.
* `cenc.date(d)` - Encodes a date object.
* `cenc.array(enc)` - Makes an array encoder from another encoder. Arrays are uint prefixed with their length.
* `cenc.raw.array(enc)` - Makes an array encoder from another encoder, without a length prefixed.
* `cenc.json` - Encodes a JSON value as utf-8.
* `cenc.raw.json` - Encodes a JSON value as utf-8 without a length prefixed.
* `cenc.ndjson` - Encodes a JSON value as newline delimited utf-8.
* `cenc.raw.ndjson` - Encodes a JSON value as newline delimited utf-8 without a length prefixed.
* `cenc.any` - Encodes any JSON representable value into a self described buffer. Like JSON + buffer, but using compact types. Useful for schemaless codecs.
* `cenc.from(enc)` - Makes a compact encoder from a [codec](https://github.com/mafintosh/codecs) or [abstract-encoding](https://github.com/mafintosh/abstract-encoding).
* `cenc.none` - Helper for when you want to just express nothing

## License

Apache 2.0
