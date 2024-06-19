var tape = require('tape')
var set = require('./')

tape('add', function (t) {
  var s = set()

  s.add({
    hello: 'world'
  })

  s.add({
    hello: 'welt'
  })

  s.add({
    hello: 'verden'
  })

  var arr = s.toArray()

  t.same(s.length, 3)
  t.same(arr.length, 3)
  t.same(arr[0].hello, 'world')
  t.same(arr[1].hello, 'welt')
  t.same(arr[2].hello, 'verden')
  t.end()
})

tape('remove', function (t) {
  var s = set()

  s.add({
    hello: 'world'
  })

  var node = s.add({
    hello: 'welt'
  })

  s.add({
    hello: 'verden'
  })

  s.remove(node)

  var arr = s.toArray()

  t.same(s.length, 2)
  t.same(arr.length, 2)
  t.same(arr[0].hello, 'world')
  t.same(arr[1].hello, 'verden')
  t.end()
})

tape('remove oldest', function (t) {
  var s = set()

  var node = s.add({
    hello: 'world'
  })

  s.add({
    hello: 'welt'
  })

  s.add({
    hello: 'verden'
  })

  s.remove(node)

  var arr = s.toArray()

  t.same(s.length, 2)
  t.same(arr.length, 2)
  t.same(arr[0].hello, 'welt')
  t.same(arr[1].hello, 'verden')
  t.end()
})

tape('remove last one', function (t) {
  var s = set()

  var node = s.add({ hello: 'world' })
  t.ok(s.has(node))
  s.remove(node)
  t.same(s.oldest, null)
  t.same(s.latest, null)
  t.end()
})

tape('remove latest', function (t) {
  var s = set()

  s.add({
    hello: 'world'
  })

  s.add({
    hello: 'welt'
  })

  var node = s.add({
    hello: 'verden'
  })

  s.remove(node)

  var arr = s.toArray()

  t.same(s.length, 2)
  t.same(arr.length, 2)
  t.same(arr[0].hello, 'world')
  t.same(arr[1].hello, 'welt')
  t.end()
})

tape('maintains time order', function (t) {
  var s = set()

  s.add({
    hello: 'world'
  })

  var n = s.add({
    hello: 'welt'
  })

  s.add({
    hello: 'verden'
  })

  s.add(n)

  var arr = s.toArray()

  t.same(s.length, 3)
  t.same(arr.length, 3)
  t.same(arr[0].hello, 'world')
  t.same(arr[1].hello, 'verden')
  t.same(arr[2].hello, 'welt')
  t.end()
})

tape('toArray subset', function (t) {
  var s = set()

  s.add({
    hello: 'world'
  })

  s.add({
    hello: 'welt'
  })

  s.add({
    hello: 'verden'
  })

  var arr = s.toArray(2)

  t.same(s.length, 3)
  t.same(arr.length, 2)
  t.same(arr[0].hello, 'world')
  t.same(arr[1].hello, 'welt')
  t.end()
})
