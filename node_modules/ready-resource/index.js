const EventEmitter = require('events')

module.exports = class ReadyResource extends EventEmitter {
  constructor () {
    super()

    this.opening = null
    this.closing = null

    this.opened = false
    this.closed = false
  }

  ready () {
    if (this.opening !== null) return this.opening
    this.opening = open(this)
    return this.opening
  }

  close () {
    if (this.closing !== null) return this.closing
    this.closing = close(this)
    return this.closing
  }

  async _open () {
    // add impl here
  }

  async _close () {
    // add impl here
  }
}

async function open (self) {
  // open after close
  if (self.closing !== null) return

  try {
    await self._open()
  } catch (err) {
    self.close() // safe to run in bg
    throw err
  }

  self.opened = true
  self.emit('ready')
}

async function close (self) {
  try {
    if (self.opened === false && self.opening !== null) await self.opening
  } catch {
    // ignore errors on closing
  }
  if (self.opened === true || self.opening === null) await self._close()
  self.closed = true
  self.emit('close')
}
