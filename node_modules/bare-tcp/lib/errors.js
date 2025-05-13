module.exports = class TCPError extends Error {
  constructor(msg, code, fn = TCPError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'TCPError'
  }

  static SOCKET_ALREADY_CONNECTED(msg) {
    return new TCPError(
      msg,
      'SOCKET_ALREADY_CONNECTED',
      TCPError.SOCKET_ALREADY_CONNECTED
    )
  }

  static SERVER_ALREADY_LISTENING(msg) {
    return new TCPError(
      msg,
      'SERVER_ALREADY_LISTENING',
      TCPError.SERVER_ALREADY_LISTENING
    )
  }

  static SERVER_IS_CLOSED(msg) {
    return new TCPError(msg, 'SERVER_IS_CLOSED', TCPError.SERVER_IS_CLOSED)
  }

  static INVALID_HOST(msg = 'Unrecognizable host format') {
    return new TCPError(msg, 'INVALID_HOST', TCPError.INVALID_HOST)
  }
}
