import EventEmitter from 'bare-events'
import os from 'bare-os'

declare interface SignalEmitter extends EventEmitter<{ [signal: string]: [] }> {
  ref(): void
  unref(): void
}

declare class SignalEmitter {}

declare class SignalError extends Error {
  static UNKNOWN_SIGNAL(msg: string): SignalError
}

declare interface Signal
  extends EventEmitter<{ close: []; signal: [signum: number] }> {
  close(): void
  ref(): void
  start(): void
  stop(): void
  unref(): void
}

declare class Signal {
  static send(signum: number | string, pid?: number): void

  constructor(signum: number | string)
}

declare namespace Signal {
  export { SignalEmitter as Emitter, SignalError as errors }

  export const constants: typeof os.constants.signals
}

export = Signal
