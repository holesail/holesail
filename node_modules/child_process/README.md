# bare-subprocess

Native process spawning for JavaScript.

```
npm i bare-subprocess
```

## Usage

```js
const { spawn } = require('bare-subprocess')

const subprocess = spawn('echo', ['hello', 'world'], {
  stdio: 'inherit'
})

subprocess.on('exit', () => console.log('done'))
```

## License

Apache-2.0
