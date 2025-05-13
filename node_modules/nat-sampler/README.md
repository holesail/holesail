# nat-sampler

Sample addresses to figure out if a host + port is consistent

```
npm install nat-sampler
```

## Usage

``` js
const NatSampler = require('nat-sampler')

const s = new NatSampler()

// add a sample
const hits = s.add('127.0.0.1', 9090)

console.log('In there this many times:', hits)
console.log('Estimated host + port', s.host, s.port)
```

## API

#### `s = new NatSampler()`

Make a new sampler.

#### `hits = s.add(host, port)`

Add a sample of your host and port.
Returns how many hits this entry has.

#### `s.host`

What the sampler thinks your host is.

If your host is unknown it will be `null`.

#### `s.port`

What the sampler thinks your port is.

If your port is random or unknown it will be `0`.

#### `s.size`

How many samples the sampler is basing this on.

## Error correction

The sampler applies some simple error correction to make sure bad samples do not mess it up.

* If it has `<=` 3 samples, it will disregard none outliers.
* If it has `<=` 7 samples, it will disregard one outliers.
* If it has `<=` 11 samples, it will disregard two outliers.
* If it has `>` 11 samples, it will disregard three outliers.

At max it keeps 16 samples of `{ host, port }` pairs for the analysis.

## License

MIT
