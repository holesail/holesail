module.exports = TimeOrderedSet

function TimeOrderedSet () {
  if (!(this instanceof TimeOrderedSet)) return new TimeOrderedSet()
  this.oldest = null
  this.latest = null
  this.length = 0
}

TimeOrderedSet.prototype.has = function (node) {
  return !!(node.next || node.prev) || node === this.oldest
}

TimeOrderedSet.prototype.add = function (node) {
  if (this.has(node)) this.remove(node)

  if (!this.latest && !this.oldest) {
    this.latest = this.oldest = node
    node.prev = node.next = null
  } else {
    this.latest.next = node
    node.prev = this.latest
    node.next = null
    this.latest = node
  }

  this.length++

  return node
}

TimeOrderedSet.prototype.remove = function (node) {
  if (!this.has(node)) return node

  if (this.oldest !== node && this.latest !== node) {
    node.prev.next = node.next
    node.next.prev = node.prev
  } else {
    if (this.oldest === node) {
      this.oldest = node.next
      if (this.oldest) this.oldest.prev = null
    }
    if (this.latest === node) {
      this.latest = node.prev
      if (this.latest) this.latest.next = null
    }
  }

  node.next = node.prev = null
  this.length--

  return node
}

TimeOrderedSet.prototype.toArray = function (pick) {
  if (!pick) pick = Infinity
  var list = []
  var node = this.oldest
  while (node && pick--) {
    list.push(node)
    node = node.next
  }
  return list
}
