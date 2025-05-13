const binding = require('./binding')

function onlookup(err, addresses) {
  const req = this

  if (err) return req.cb(err, null, 0)

  const { address, family } = addresses[0]

  return req.cb(null, address, family)
}

function onlookupall(err, addresses) {
  const req = this

  if (err) return req.cb(err, null)

  return req.cb(null, addresses)
}

exports.lookup = function lookup(hostname, opts = {}, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  let { family = 0, all = false } = opts

  if (typeof family === 'string') {
    switch (family) {
      case 'IPv4':
        family = 4
        break
      case 'IPv6':
        family = 6
        break
      default:
        family = 0
    }
  }

  const req = {
    cb,
    handle: null
  }

  req.handle = binding.lookup(
    hostname,
    family || 0,
    all,
    req,
    all ? onlookupall : onlookup
  )
}
