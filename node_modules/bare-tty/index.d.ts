import {
  Readable,
  ReadableOptions,
  Writable,
  WritableEvents,
  WritableOptions
} from 'bare-stream'

interface ReadStream extends Readable {
  readonly isTTY: true

  setMode(mode: number): this

  setRawMode(mode: boolean): this
}

declare class ReadStream extends Readable {
  constructor(fd: number, opts?: ReadableOptions)
}

interface WriteStreamEvents extends WritableEvents {
  resize: []
}

interface WriteStream<M extends WriteStreamEvents = WriteStreamEvents>
  extends Writable<M> {
  readonly isTTY: true
  readonly columns: number
  readonly rows: number

  getWindowSize(): [width: number, height: number]
}

declare class WriteStream<
  M extends WriteStreamEvents = WriteStreamEvents
> extends Writable<M> {
  constructor(fd: number, opts?: WritableOptions)
}

declare function isTTY(fd: number): boolean

declare const constants: {
  mode: { NORMAL: number; RAW: number; IO: number }
  state: { READING: number; CLOSING: number }
}

export { ReadStream, WriteStream, isTTY, isTTY as isatty, constants }
