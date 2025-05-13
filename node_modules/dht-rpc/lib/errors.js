module.exports = class DHTError extends Error {
  constructor (msg, code, fn = DHTError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name () {
    return 'DHTError'
  }

  static UNKNOWN_COMMAND = 1
  static INVALID_TOKEN = 2

  static REQUEST_TIMEOUT (msg = 'Request timed out') {
    return new DHTError(msg, 'REQUEST_TIMEOUT', DHTError.REQUEST_TIMEOUT)
  }

  static REQUEST_DESTROYED (msg = 'Request destroyed') {
    return new DHTError(msg, 'REQUEST_DESTROYED', DHTError.REQUEST_DESTROYED)
  }

  static IO_SUSPENDED (msg = 'I/O suspended') {
    return new DHTError(msg, 'IO_SUSPENDED', DHTError.IO_SUSPENDED)
  }
}
