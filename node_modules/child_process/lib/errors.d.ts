declare class SubprocessError extends Error {
  readonly code: string

  static UNKNOWN_SIGNAL(msg: string): SubprocessError
}

export = SubprocessError
