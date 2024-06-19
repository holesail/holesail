const tape = require('tape')

run('', require('./'))
run('browser: ', require('./browser'))

function run (prefix, Timeout) {
  tape(prefix + 'refresh', function (t) {
    let refreshing = true
    let timedout = false

    const ctx = {}
    const to = Timeout.once(100, function () {
      t.ok(ctx === this)
      t.ok(!refreshing)
      timedout = true
    }, ctx)

    const i = setInterval(function () {
      to.refresh()
    }, 50)

    setTimeout(function () {
      refreshing = false
      clearInterval(i)
      setTimeout(function () {
        t.ok(timedout)
        t.end()
      }, 100)
    }, 500)
  })

  tape(prefix + 'destroy', function (t) {
    let timedout = false

    const to = Timeout.once(100, function () {
      t.fail('should be destroyed')
      timedout = true
    })

    const i = setInterval(function () {
      to.refresh()
    }, 50)

    setTimeout(function () {
      clearInterval(i)
      to.destroy()
      setTimeout(function () {
        t.ok(!timedout)
        t.end()
      }, 100)
    }, 500)
  })

  tape(prefix + 'cannot be refreshed after call', function (t) {
    t.plan(2)

    let timedout = false

    const to = Timeout.once(50, function () {
      t.notOk(timedout, 'did not already timeout')
      t.pass('should be destroyed')
      to.refresh()
      timedout = true
    })

    setTimeout(function () {
      t.end()
    }, 500)
  })

  tape(prefix + 'setInterval', function (t) {
    t.plan(1)

    const actual = []
    let tick = 0

    const i = setInterval(function () {
      tick++
    }, 100)

    const to = Timeout.on(500, function () {
      actual.push(tick)

      if (actual.length === 2) {
        setTimeout(() => {
          to.refresh()
          setTimeout(() => {
            to.refresh()
          }, 250)
        }, 250)
      }

      if (actual.length === 4) {
        to.destroy()
        clearInterval(i)

        t.same(actual.map(n => Math.round(n / 5)), [1, 2, 4, 5])
        t.end()
      }
    })
  })
}
