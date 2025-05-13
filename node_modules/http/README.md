# bare-http1

HTTP/1 library for JavaScript.

```
npm i bare-http1
```

## Usage

```js
const http = require('bare-http1')

const server = http.createServer((req, res) => {
  res.statusCode = 200
  res.setHeader('Content-Length', 10)
  res.write('hello world!')
  res.end()
})

server.listen(0, () => {
  const { port } = server.address()
  console.log('server is bound on', port)

  const client = http.request({ port }, (res) => {
    res.on('data', (data) => console.log(data.toString()))
  })
  client.end()
})
```

## License

Apache-2.0
