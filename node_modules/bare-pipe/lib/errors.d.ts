declare class PipeError extends Error {
  static PIPE_ALREADY_CONNECTED(msg: string): PipeError
  static SERVER_ALREADY_LISTENING(msg: string): PipeError
  static SERVER_IS_CLOSED(msg: string): PipeError
}

export = PipeError
