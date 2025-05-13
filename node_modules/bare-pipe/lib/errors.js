module.exports = class PipeError extends Error {
  constructor(msg, code, fn = PipeError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'PipeError'
  }

  static PIPE_ALREADY_CONNECTED(msg) {
    return new PipeError(
      msg,
      'PIPE_ALREADY_CONNECTED',
      PipeError.PIPE_ALREADY_CONNECTED
    )
  }

  static SERVER_ALREADY_LISTENING(msg) {
    return new PipeError(
      msg,
      'SERVER_ALREADY_LISTENING',
      PipeError.SERVER_ALREADY_LISTENING
    )
  }

  static SERVER_IS_CLOSED(msg) {
    return new PipeError(msg, 'SERVER_IS_CLOSED', PipeError.SERVER_IS_CLOSED)
  }
}
