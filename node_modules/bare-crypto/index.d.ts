import { Transform, TransformOptions } from 'bare-stream'
import Buffer, { BufferEncoding } from 'bare-buffer'

type Algorithm = 'MD5' | 'SHA1' | 'SHA256' | 'SHA512' | 'BLAKE2B256'

export const constants: { hash: Record<Algorithm, number> }

declare class CryptoError extends Error {
  static UNSUPPORTED_DIGEST_METHOD(msg: string): CryptoError
}

export class Hash extends Transform {
  constructor(
    algorithm: Algorithm | Lowercase<Algorithm> | number,
    opts?: TransformOptions<Hash>
  )

  update(data: string, encoding?: BufferEncoding): this
  update(data: Buffer, encoding?: 'buffer'): this

  digest(encoding: BufferEncoding): string
  digest(): Buffer
}

export function createHash(
  algorithm: Algorithm | Lowercase<Algorithm> | number,
  opts?: TransformOptions<Hash>
): Hash

export function randomBytes(size: number): Buffer

export function randomBytes(
  size: number,
  callback: (err: Error | null, buffer: Buffer) => void
): void

export function randomFill<B extends ArrayBuffer | ArrayBufferView>(
  buffer: B,
  offset?: number,
  size?: number
): B

export function randomFill<B extends ArrayBuffer | ArrayBufferView>(
  buffer: B,
  callback: (err: Error | null, buffer: B) => void
): void

export function randomFill<B extends ArrayBuffer | ArrayBufferView>(
  buffer: B,
  offset: number,
  callback: (err: Error | null, buffer: B) => void
): void

export function randomFill<B extends ArrayBuffer | ArrayBufferView>(
  buffer: B,
  offset: number,
  size: number,
  callback: (err: Error | null, buffer: B) => void
): void

export function randomFillSync<B extends ArrayBuffer | ArrayBufferView>(
  buffer: B,
  offset?: number,
  size?: number
): B

export { CryptoError as errors }

export * as webcrypto from './web'
