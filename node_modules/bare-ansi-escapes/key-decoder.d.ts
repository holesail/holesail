import { Transform, TransformEvents } from 'bare-stream'
import { BufferEncoding } from 'bare-buffer'

interface KeyDecoderOptions {
  encoding?: BufferEncoding
  escapeCodeTimeout?: number
}

interface KeyDecoderEvents extends TransformEvents {
  data: [key: Key]
}

interface KeyDecoder<M extends KeyDecoderEvents = KeyDecoderEvents>
  extends Transform<M> {
  readonly encoding: BufferEncoding
}

declare class KeyDecoder {
  constructor(opts?: KeyDecoderOptions)
}

interface Key {
  readonly name: string
  readonly sequence: string
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
}

declare class Key {
  constructor(
    name: string | number,
    sequence: string,
    ctrl: boolean,
    meta: boolean,
    shift: boolean
  )
}

declare namespace KeyDecoder {
  export type { KeyDecoderOptions, KeyDecoderEvents, Key }
}

export = KeyDecoder
