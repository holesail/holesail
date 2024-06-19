const RoutingTable = require('./')
const { randomBytes } = require('crypto')

const table = new RoutingTable(randomBytes(32))

table.on('row', function (row) {
  row.on('remove', function (node) {
    console.log('remove node', node, 'from row', row.index)
  })

  row.on('add', function (node) {
    console.log('add node', node, 'to row', row.index)
  })

  row.on('full', function (node) {
    console.log('row', row.index, 'is full, cannot add', node)
  })
})

for (let i = 0; i < 40; i++) {
  table.add({
    id: randomBytes(32)
  })
}

console.log('The 20 closest nodes to', table.id, 'are:', table.closest(20))
