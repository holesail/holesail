# bare-dns

Domain name resolution for JavaScript.

```
npm i bare-dns
```

## Usage

```js
const dns = require('bare-dns')

dns.lookup('github.com', (err, address, family) => {
  console.log(address, family)
})
```

## License

Apache-2.0
