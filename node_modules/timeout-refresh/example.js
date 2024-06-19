const Timeout = require('./')

const to = Timeout.once(100, function () {
  console.log('Timed out!')
})

const i = setInterval(function () {
  // refresh every 50ms
  to.refresh()
}, 50)

setTimeout(function () {
  // cancel the refresh after 500ms
  clearInterval(i)
  console.log('Stopping refresh')
  setTimeout(function () {
    console.log('Should have timed out now')
  }, 200)
}, 500)
