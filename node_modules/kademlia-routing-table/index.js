const { EventEmitter } = require('events')

module.exports = class RoutingTable extends EventEmitter {
  constructor (id, opts) {
    if (!opts) opts = {}

    super()

    this.id = id
    this.k = opts.k || 20
    this.rows = new Array(id.length * 8)
  }

  add (node) {
    const i = this._diff(node.id)

    let row = this.rows[i]

    if (!row) {
      row = this.rows[i] = new Row(this, i)
      this.emit('row', row)
    }

    return row.add(node, this.k)
  }

  remove (id) {
    const i = this._diff(id)
    const row = this.rows[i]
    if (!row) return false
    return row.remove(id)
  }

  get (id) {
    const i = this._diff(id)
    const row = this.rows[i]
    if (!row) return null
    return row.get(id)
  }

  has (id) {
    return this.get(id) !== null
  }

  random () {
    const offset = (Math.random() * this.rows.length) | 0

    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[(i + offset) % this.rows.length]
      if (r && r.nodes.length) return r.random()
    }

    return null
  }

  closest (id, k) {
    if (!k) k = this.k

    const result = []
    const d = this._diff(id)

    // push close nodes
    for (let i = d; i >= 0 && result.length < k; i--) this._pushNodes(i, k, result)

    // if we don't have enough close nodes, populate from other rows, re the paper
    for (let i = d + 1; i < this.rows.length && result.length < k; i++) this._pushNodes(i, k, result)

    return result
  }

  _pushNodes (i, k, result) {
    const row = this.rows[i]
    if (!row) return

    const missing = Math.min(k - result.length, row.nodes.length)
    for (let j = 0; j < missing; j++) result.push(row.nodes[j])
  }

  toArray () {
    return this.closest(this.id, Infinity)
  }

  _diff (id) {
    for (let i = 0; i < id.length; i++) {
      const a = id[i]
      const b = this.id[i]

      if (a !== b) return i * 8 + Math.clz32(a ^ b) - 24
    }

    return this.rows.length - 1
  }
}

class Row extends EventEmitter {
  constructor (table, index) {
    super()

    this.data = null // can be used be upstream for whatevs
    this.index = index
    this.table = table
    this.nodes = []
  }

  add (node) {
    const id = node.id

    let l = 0
    let r = this.nodes.length - 1

    while (l <= r) {
      const m = (l + r) >> 1
      const c = this.compare(id, this.nodes[m].id)

      if (c === 0) {
        this.nodes[m] = node
        return true
      }

      if (c < 0) r = m - 1
      else l = m + 1
    }

    if (this.nodes.length >= this.table.k) {
      this.emit('full', node)
      return false
    }

    this.insert(l, node)
    return true
  }

  remove (id) {
    let l = 0
    let r = this.nodes.length - 1

    while (l <= r) {
      const m = (l + r) >> 1
      const c = this.compare(id, this.nodes[m].id)

      if (c === 0) {
        this.splice(m)
        return true
      }

      if (c < 0) r = m - 1
      else l = m + 1
    }

    return false
  }

  get (id) {
    let l = 0
    let r = this.nodes.length - 1

    while (l <= r) {
      const m = (l + r) >> 1
      const node = this.nodes[m]
      const c = this.compare(id, node.id)

      if (c === 0) return node
      if (c < 0) r = m - 1
      else l = m + 1
    }

    return null
  }

  random () {
    return this.nodes.length ? this.nodes[(Math.random() * this.nodes.length) | 0] : null
  }

  insert (i, node) {
    this.nodes.push(node) // push node or null or whatevs, just trying to not be polymorphic
    for (let j = this.nodes.length - 1; j > i; j--) this.nodes[j] = this.nodes[j - 1]
    this.nodes[i] = node
    this.emit('add', node)
  }

  splice (i) {
    for (; i < this.nodes.length - 1; i++) this.nodes[i] = this.nodes[i + 1]
    this.emit('remove', this.nodes.pop())
  }

  compare (a, b) {
    for (let i = this.index; i < a.length; i++) {
      const ai = a[i]
      const bi = b[i]
      if (ai === bi) continue
      return ai < bi ? -1 : 1
    }
    return 0
  }
}
