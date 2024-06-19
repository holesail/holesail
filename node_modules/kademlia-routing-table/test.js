const test = require('brittle')
const { randomBytes } = require('crypto')
const RoutingTable = require('./')

test('basic', function (assert) {
  const table = new RoutingTable(id())
  const node = { id: id() }

  assert.ok(table.add(node))
  assert.alike(table.closest(id()), [node])
})

function id () {
  return randomBytes(32)
}
