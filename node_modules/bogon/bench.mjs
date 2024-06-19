import bench from 'nanobench'
import b4a from 'b4a'

import isBogon from './index.js'

bench('string', (b) => {
  const ip = '255.255.255.255'

  b.start()

  let result

  for (let i = 0; i < 10000000; i++) {
    result = isBogon(ip)
  }

  b.log(result)
  b.end()
})

bench('buffer', (b) => {
  const ip = b4a.from([255, 255, 255, 255])

  b.start()

  let result

  for (let i = 0; i < 10000000; i++) {
    result = isBogon(ip)
  }

  b.log(result)
  b.end()
})
