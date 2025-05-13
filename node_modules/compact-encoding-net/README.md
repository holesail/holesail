# compact-encoding-net

[compact-encoding](https://github.com/compact-encoding/compact-encoding) codecs for net types.

## Installation

```sh
npm install compact-encoding-net
```

## Codecs

### `port`

Codec for 16 bit port numbers.

```js
const { port } = require('compact-encoding-net')
```

#### Encoding

```js
const buffer = cenc.encode(port, 8080)
```

#### Decoding

```js
cenc.decode(port, buffer)
// 8080
```

### `ipv4`

Codec for IPv4 addresses.

> :warning: The codec is only defined for valid IPv4 addresses.

```js
const { ipv4 } = require('compact-encoding-net')
```

#### Encoding

```js
const buffer = cenc.encode(ipv4, '127.0.0.1')
```

#### Decoding

```js
cenc.decode(ipv4, buffer)
// '127.0.0.1'
```

### `ipv4Address`

Codec for IPv4 addresses plus a port.

```js
const { ipv4Address } = require('compact-encoding-net')
```

#### Encoding

```js
const buffer = cenc.encode(ipv4, { host: '127.0.0.1', port: 8080 })
```

#### Decoding

```js
cenc.decode(ipv4Address, buffer)
// { host: '127.0.0.1', port: 8080 }
```

### `ipv6`

Codec for IPv6 addresses.

> :warning: The codec is only defined for valid IPv6 addresses.

```js
const { ipv6 } = require('compact-encoding-net')
```

#### Encoding

```js
const buffer = cenc.encode(ipv6, '::1')
```

#### Decoding

```js
cenc.decode(ipv6, buffer)
// '0:0:0:0:0:0:0:1'
```

### `ipv6Address`

Codec for IPv6 addresses plus a port.

```js
const { ipv6Address } = require('compact-encoding-net')
```

#### Encoding

```js
const buffer = cenc.encode(ipv6Address, { host: '::1', port: 8080 })
```

#### Decoding

```js
cenc.decode(ipv6Address, buffer)
// { host: '0:0:0:0:0:0:0:1', port: 8080 }
```

### `ip`

Codec for dual IPv4/6 addresses.

> :warning: The codec is only defined for valid IPv4 and IPv6 addresses.

```js
const { ip } = require('compact-encoding-net')
```

#### Encoding

```js
const buffer = cenc.encode(ip, '::1')
```

#### Decoding

```js
cenc.decode(ip, buffer)
// '0:0:0:0:0:0:0:1'
```

### `ipAddress`

Codec for dual IPv4/6 addresses plus a port.

```js
const { ipAddress } = require('compact-encoding-net')
```

#### Encoding

```js
const buffer = cenc.encode(ipAddress, { host: '::1', port: 8080 })
```

#### Decoding

```js
cenc.decode(ipv6Address, buffer)
// { host: '0:0:0:0:0:0:0:1', family: 6, port: 8080 }
```

## License

ISC
