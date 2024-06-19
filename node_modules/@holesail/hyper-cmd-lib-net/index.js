

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

  if (opts.compress) {
    const { gzip, gunzip } = require('node:zlib')
    const l2c = opts.isServer ? gzip : gunzip
    const c2l = opts.isServer ? gunzip : gzip

    loc.on('data', d => {
      loc.pause()
      l2c(d, (err, o) => {
        loc.resume()
        if (err) {
          console.error(err)
          destroy(err)
          return
        }

        connection.write(o)
      })
    })

    connection.on('data', d => {
      connection.pause()
      c2l(d, (err, o) => {
        connection.resume()
        if (err) {
          console.error(err)
          destroy(err)
          return
        }

        loc.write(o)
      })
    })
  } else {
    loc.on('data', d => {
      connection.write(d)
    })

    connection.on('data', d => {
      loc.write(d)
    })
  }

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

function connRemoteCtrl (connection, opts = {}, stats = {}) {
  if (!stats.remCnt) {
    stats.remCnt = 0
  }

  stats.remCnt++

  let destroyed = false

  connection.on('error', destroy)
  connection.on('close', destroy)

  connection.on('error', err => {
    if (opts.debug) {
      console.error(err)
    }
  })

  function destroy (err) {
    if (destroyed) {
      return
    }

    stats.remCnt--

    destroyed = true

    connection.destroy(err)

    if (opts.onDestroy) {
      opts.onDestroy(err)
    }
  }

  function send (data) {
    if (destroyed) {
      return
    }

    connection.write(data)
  }

  return {
    send
  }
}

module.exports = {
  connPiper,
  connRemoteCtrl
}
