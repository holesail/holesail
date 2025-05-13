import EventEmitter, { EventMap } from 'bare-events'
import { Duplex, DuplexEvents } from 'bare-stream'
import PipeError from './lib/errors'
import constants from './lib/constants'

interface PipeEvents extends DuplexEvents {
  connect: []
}

interface PipeOptions {
  allowHalfOpen?: boolean
  eagerOpen?: boolean
  readBufferSize?: number
}

interface PipeConnectOptions {
  path?: string
}

interface Pipe<M extends PipeEvents = PipeEvents> extends Duplex<M> {
  readonly connecting: boolean
  readonly pending: boolean
  readonly readyState: 'open' | 'readOnly' | 'writeOnly'

  open(fd: number, opts?: { fd?: number }, onconnect?: () => void): this

  open(fd: number, onconnect: () => void): this

  open(opts: { fd: number }, onconnect?: () => void): this

  connect(path: string, opts?: PipeConnectOptions, onconnect?: () => void): this

  connect(path: string, onconnect: () => void): this

  connect(opts: PipeConnectOptions, onconnect?: () => void): this

  ref(): void

  unref(): void
}

declare class Pipe<M extends PipeEvents = PipeEvents> extends Duplex<M> {
  constructor(path: string | number, opts?: PipeOptions)

  constructor(opts?: PipeOptions)
}

interface PipeServerEvents extends EventMap {
  close: []
  connection: [pipe: Pipe]
  err: [err: Error]
  listening: []
}

interface PipeServerOptions {
  readBufferSize?: number
  allowHalfOpen?: boolean
}

interface PipeServerListenOptions {
  path?: string
  backlog?: number
}

interface PipeServer<M extends PipeServerEvents = PipeServerEvents>
  extends EventEmitter<M> {
  readonly listening: boolean

  address(): string | null

  listen(
    path: string,
    backlog?: number,
    opts?: PipeServerListenOptions,
    onlistening?: () => void
  ): this

  listen(path: string, backlog: number, onlistening: () => void): this

  listen(path: string, onlistening: () => void): this

  listen(opts: PipeServerListenOptions): this

  close(onclose?: () => void): void

  ref(): void

  unref(): void
}

declare class PipeServer<
  M extends PipeServerEvents = PipeServerEvents
> extends EventEmitter<M> {
  constructor(opts?: PipeServerOptions, onconnection?: () => void)

  constructor(onconnection: () => void)
}

declare namespace Pipe {
  export interface CreateConnectionOptions
    extends PipeOptions,
      PipeConnectOptions {}

  export function createConnection(
    path: string,
    opts?: CreateConnectionOptions,
    onconnect?: () => void
  ): Pipe

  export function createConnection(path: string, onconnect: () => void): Pipe

  export function createConnection(
    opts: CreateConnectionOptions,
    onconnect?: () => void
  ): Pipe

  export function createServer(
    opts?: PipeServerOptions,
    onconnection?: () => void
  ): PipeServer

  export function pipe(): [read: number, write: number]

  export {
    type PipeEvents,
    type PipeOptions,
    Pipe,
    type PipeConnectOptions,
    type PipeServerEvents,
    type PipeServerOptions,
    type PipeServerListenOptions,
    type PipeServer,
    PipeServer as Server,
    type PipeError,
    PipeError as errors,
    constants
  }
}

export = Pipe
