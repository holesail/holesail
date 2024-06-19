module.exports = class BlindRelayError extends Error {
  constructor (msg, code, fn = BlindRelayError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name () {
    return 'BlindRelayError'
  }

  static DUPLICATE_CHANNEL (msg = 'Duplicate channel') {
    return new BlindRelayError(msg, 'DUPLICATE_CHANNEL', BlindRelayError.DUPLICATE_CHANNEL)
  }

  static CHANNEL_CLOSED (msg = 'Channel closed') {
    return new BlindRelayError(msg, 'CHANNEL_CLOSED', BlindRelayError.CHANNEL_CLOSED)
  }

  static CHANNEL_DESTROYED (msg = 'Channel destroyed') {
    return new BlindRelayError(msg, 'CHANNEL_DESTROYED', BlindRelayError.CHANNEL_DESTROYED)
  }

  static ALREADY_PAIRING (msg = 'Already pairing') {
    return new BlindRelayError(msg, 'ALREADY_PAIRING', BlindRelayError.ALREADY_PAIRING)
  }

  static PAIRING_CANCELLED (msg = 'Pairing cancelled') {
    return new BlindRelayError(msg, 'PAIRING_CANCELLED', BlindRelayError.PAIRING_CANCELLED)
  }
}
