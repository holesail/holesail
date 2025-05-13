module.exports = class HTTPError extends Error {
  constructor(msg, code, fn = HTTPError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'HTTPError'
  }

  static NOT_IMPLEMENTED(msg = 'Method not implemented') {
    return new HTTPError(msg, 'NOT_IMPLEMENTED', HTTPError.NOT_IMPLEMENTED)
  }

  static CONNECTION_LOST(msg = 'Socket hung up') {
    return new HTTPError(msg, 'CONNECTION_LOST', HTTPError.CONNECTION_LOST)
  }
}
