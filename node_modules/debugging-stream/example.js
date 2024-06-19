const Debugging = require('./')

const l = new Debugging(process.stdin, { latency: [1500, 2000] })

l.on('data', function (data) {
  console.log('-->', data)
})
