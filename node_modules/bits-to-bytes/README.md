# Bits to Bytes

Functions for doing bit manipulation of typed arrays.

```npm
npm i bits-to-bytes
```

## Usage

```js
const bits = require('bits-to-bytes')

const buffer = Uint8Array.from([0b11001000])

bits.get(buffer, 3)
// true
```

`buffer` may be any typed array with a `number` element type, including `Uint8Array`, `Uint16Array`, and `Uint32Array`.

## API

#### `const n = bits.byteLength(size)`

Get the number of bytes required to contain `size` bits.

#### `const b = bits.get(buffer, bit)`

Get the given bit, which will either be `true` (set) or `false` (unset).

#### `const changed = bits.set(buffer, bit[, value])`

Set the given bit to `value`, which defaults to `true`. Returns `true` if the bit changed, otherwise `false`.

#### `const changed = bits.setRange(buffer, start, end[, value])`

Set the given bit range to `value`, which defaults to `true`. Returns `true` if any of the bits changed, otherwise `false`.

If you don't need the additional information about whether any of the bits changed, consider `bits.fill()` as a more performant alternative.

#### `buffer = bits.fill(buffer, value[, start[, end]])`

Fill the given bit range with `value`. `start` defaults to `0` and `end` defaults to the bit length of the array. Returns the modified array.

#### `const b = bits.toggle(buffer, bit)`

Toggle the given bit, returning its new value.

#### `const changed = bits.remove(buffer, bit)`

Unset the given bit. Returns `true` if the bit was set, otherwise `false`.

#### `const changed = bits.removeRange(buffer, start, end)`

Unset the given bit range. Returns `true` if any of the bits were set, otherwise `false`.

#### `const index = bits.indexOf(buffer, value[, position])`

Return the index of the first occurrence of `value`, or `-1` if not found. If `position` is given, return the first index that is greater than or equal to `position`.

#### `const index = bits.lastIndexOf(buffer, value[, position])`

Return the index of the last occurrence of `value`, or `-1` if not found. If `position` is given, return the last index that is less than or equal to `position`.

#### `const buffer = bits.of(...values)`

Create a buffer containing the given bits.

#### `const buffer = bits.from(values)`

Create a buffer containing the given bits.

#### `const iterator = bits.iterator(buffer)`

Create an iterator over bits.

## License

ISC
