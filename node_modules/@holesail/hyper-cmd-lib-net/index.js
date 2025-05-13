const dgram = require('bare-dgram')
const EventEmitter = require('events')

function connPiper (connection, _dst, opts = {}, stats = {}) {
  const loc = _dst()
  if (loc === null) {
    connection.destroy() // don't return rejection error

    if (!stats.rejectCnt) {
      stats.rejectCnt = 0
    }

    stats.rejectCnt++

    return
  }

  if (!stats.locCnt) {
    stats.locCnt = 0
  }

  if (!stats.remCnt) {
    stats.remCnt = 0
  }

  stats.locCnt++
  stats.remCnt++

  let destroyed = false

  loc.on('data', d => {
    connection.write(d)
  })

  connection.on('data', d => {
    loc.write(d)
  })

  loc.on('error', destroy).on('close', destroy)
  connection.on('error', destroy).on('close', destroy)

  loc.on('end', () => connection.end())
  connection.on('end', () => loc.end())

  loc.on('connect', err => {
    if (opts.debug) {
      console.log('connected')
    }
    if (err) {
      console.error(err)
    }
  })

  function destroy (err) {
    if (destroyed) {
      return
    }

    stats.locCnt--
    stats.remCnt--

    destroyed = true

    loc.end()
    connection.end()

    loc.destroy(err)
    connection.destroy(err)

    if (opts.onDestroy) {
      opts.onDestroy(err)
    }
  }

  return {}
}

class udpSocket {
  constructor (opts) {
    this.opts = opts
    this.server = dgram.createSocket('udp4')
    this.client = dgram.createSocket('udp4')
    this.event = new EventEmitter()
    this.rinfo = null
    this.connect()
  }

  connect () {
    if (this.opts.bind) {
      this.server.bind(this.opts.port, this.opts.host)
    }

    this.server.on('message', (msg, rinfo) => {
      this.event.emit('message', msg, rinfo)
      this.rinfo = rinfo
    })

    this.client.on('message', (response, rinfo) => {
      this.event.emit('message', response)
    })

    this.client.on('error', (err) => {
      console.error(`UDP error: \n${err.stack}`)
      this.client.close()
    })
  }

  write (msg) {
    if (this.rinfo) {
      this.server.send(msg, 0, msg.length, this.rinfo.port, this.rinfo.address)
    } else {
      this.client.send(msg, 0, msg.length, this.opts.port, this.opts.host)
    }
  }
}

class udpConnPiper {
  constructor (connection, _dst, opts = {}, stats = {}) {
    this.loc = _dst()
    this.connection = connection

    this.stats = {
      rejectCnt: 0,
      locCnt: 0,
      remCnt: 0
    }

    this.destroyed = false

    // Connect
    this.connect()
  }

  connect () {
    if (this.loc === null) {
      this.connection.destroy()
      return
    }

    this.loc.event.on('message', (msg, rinfo) => {
      this.connection.trySend(msg)
    })

    this.connection.on('message', (msg) => {
      this.loc.write(msg)
    })

    this.loc.server.on('error', this.destroy).on('close', this.destroy)
    this.connection.on('error', this.destroy).on('close', this.destroy)
  }

  destroy (err) {
    // TODO: Add destroy functionality
  }
}

function udpConnect (opts) {
  return new udpSocket(opts)
}

function udpPiper (connection, _dst, opts = {}, stats = {}) {
  return new udpConnPiper(connection, _dst, opts = {}, stats = {})
}

module.exports = {
  connPiper,
  udpPiper,
  udpConnect
}
