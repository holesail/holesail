module.exports = class SubprocessError extends Error {
  constructor(msg, code, fn = SubprocessError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'SubprocessError'
  }

  static UNKNOWN_SIGNAL(msg) {
    return new SubprocessError(
      msg,
      'UNKNOWN_SIGNAL',
      SubprocessError.UNKNOWN_SIGNAL
    )
  }
}
