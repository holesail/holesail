module.exports = isNode()
  ? require('./node')
  : require('./browser')

function isNode () {
  const to = setTimeout(function () {}, 1000)
  clearTimeout(to)
  return !!to.refresh
}
