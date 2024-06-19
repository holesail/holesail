module.exports = class Signal {
  constructor () {
    this._resolve = null
    this._reject = null
    this._promise = null
    this._bind = bind.bind(this)
    this._onerror = clear.bind(this)
    this._onsuccess = clear.bind(this, null)
    this._timers = new Set()
  }

  wait (max) {
    if (!this._promise) {
      this._promise = new Promise(this._bind)
      this._promise.then(this._onsuccess).catch(this._onerror)
    }
    if (max) return this._sleep(max)
    return this._promise
  }

  _sleep (max) {
    const s = new Promise((resolve, reject) => {
      const done = () => {
        this._timers.delete(state)
        resolve(true)
      }
      const id = setTimeout(done, max)
      const state = { id, resolve, reject }
      this._timers.add(state)
    })

    return s
  }

  notify (err) {
    if (!this._promise) return
    const resolve = this._resolve
    const reject = this._reject
    this._promise = null
    if (err) reject(err)
    else resolve(true)
  }
}

function clear (err) {
  for (const { id, resolve, reject } of this._timers) {
    clearTimeout(id)
    if (err) reject(err)
    else resolve(true)
  }
  this._timers.clear()
}

function bind (resolve, reject) {
  this._resolve = resolve
  this._reject = reject
}
