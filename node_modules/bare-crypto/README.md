# bare-crypto

Cryptographic primitives for JavaScript.

```
npm i bare-crypto
```

## Usage

```js
const crypto = require('bare-crypto')

const hash = crypto.createHash('sha256')

hash.update('Hello, world!')

const digest = hash.digest('hex')

console.log(digest)
```

## API

#### `const hash = createHash(algorithm[, options])`

Create a new `Hash` instance with the specified algorithm and options. The options are passed to [`new Transform()`](https://github.com/mafintosh/streamxts--new-streamtransformoptions).

#### `const buffer = randomBytes(size)`

Generate cryptographically secure random bytes.

#### `randomBytes(size, callback)`

Generate cryptographically secure random bytes, asynchronously providing the result in `callback`. The callback signature is `callback(err, buffer)`.

#### `buffer = randomFill(buffer[, offset][, size])`

Fill a buffer with cryptographically secure random bytes.

#### `randomFill(buffer[, offset][, size], callback)`

Fill a buffer with cryptographically secure random bytes, asynchronously providing the result in `callback`. The callback signature is `callback(err, buffer)`

#### `constants.hash`

The supported hash algorithms.

| Constant     | Description                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MD5`        | A widely-used 128-bit hash function, now considered insecure due to vulnerabilities to collision attacks. Still fast but not recommended for security-sensitive purposes.             |
| `SHA1`       | A 160-bit hash function, stronger than MD5 but also broken by collision attacks. Deprecated for most cryptographic uses due to security vulnerabilities.                              |
| `SHA256`     | Part of the SHA-2 family, this 256-bit hash function is widely used and considered secure for most applications. Slower than MD5 and SHA1 but much more secure.                       |
| `SHA512`     | Another member of the SHA-2 family, this 512-bit hash function offers greater security than SHA256 but is slower and produces larger hashes. Suitable for high-security environments. |
| `BLAKE2B256` | A fast, secure alternative to SHA-2 designed for efficiency, producing a 256-bit hash. It is optimized for performance while maintaining strong cryptographic security.               |

## License

Apache-2.0
