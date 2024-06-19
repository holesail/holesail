# bogon

Check if an IP is a bogon

```
npm install bogon
```

https://ipinfo.io/bogon


## Usage

``` js
const bogon = require('bogon')

console.log(bogon('192.168.0.1')) // true
console.log(bogon('8.8.8.8')) // false
```

As a utility it also exposes an `isPrivate` helper
to detect if a bogon IP is a private IP address on a local network.

``` js
console.log(bogon.isPrivate('192.168.0.1')) // true
console.log(bogon('224.0.1.1')) // true
console.log(bogon.isPrivate('224.0.1.1')) // false
```

## License

MIT
