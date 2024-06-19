const Signal = require('./')

const s = new Signal()

main().catch(console.error)

async function main () {
  while (await s.wait(2000)) {
    console.log('nu!')
  }
  console.log('efter')
}

process.stdin.on('data', function () {
  s.notify()
})
