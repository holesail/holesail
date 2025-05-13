module.exports = class SignalError extends Error {
  constructor(msg, code, fn = SignalError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'SignalError'
  }

  static UNKNOWN_SIGNAL(msg) {
    return new SignalError(msg, 'UNKNOWN_SIGNAL', SignalError.UNKNOWN_SIGNAL)
  }
}
