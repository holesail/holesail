import EventEmitter, { EventMap } from 'bare-events'
import { Duplex, DuplexOptions, DuplexEvents } from 'bare-stream'
import { IPFamily, LookupOptions } from 'bare-dns'

interface DNSLookup {
  (
    hostname: string,
    opts: LookupOptions,
    cb: (
      err: Error | null,
      address: string | null,
      family: IPFamily | 0
    ) => void
  ): void
}

interface TCPSocketAddress {
  address: string
  family: `IPv${IPFamily}`
  port: number
}

interface TCPSocketEvents extends DuplexEvents {
  connect: []
  lookup: [
    err: Error | null,
    address: string | null,
    family: IPFamily | 0,
    host: string
  ]
  timeout: [ms: number]
}

interface TCPSocketOptions<S extends TCPSocket = TCPSocket>
  extends DuplexOptions<S> {
  readBufferSize?: number
  allowHalfOpen?: boolean
}

interface TCPSocketConnectOptions extends LookupOptions {
  lookup?: DNSLookup
  host?: string
  keepAlive?: boolean
  keepAliveInitialDelay?: boolean
  noDelay?: boolean
  port?: number
  timeout?: number
}

declare class TCPSocket<
  M extends TCPSocketEvents = TCPSocketEvents
> extends Duplex<M> {
  constructor(opts?: TCPSocketOptions)

  readonly connecting: boolean
  readonly pending: boolean
  readonly timeout?: number

  connect(
    port: number,
    host?: string,
    opts?: TCPSocketConnectOptions,
    onconnect?: () => void
  ): this

  connect(port: number, host: string, onconnect: () => void): this
  connect(port: number, onconnect: () => void): this
  connect(opts: TCPSocketConnectOptions): this

  setKeepAlive(enable?: boolean, delay?: number): this
  setKeepAlive(delay: number): this

  setNoDelay(enable?: boolean): this

  setTimeout(ms: number, ontimeout?: () => void): this

  ref(): void
  unref(): void
}

interface TCPServerEvents extends EventMap {
  close: []
  connection: [socket: TCPSocket]
  error: [err: Error]
  listening: []
  lookup: [
    err: Error | null,
    address: string | null,
    family: IPFamily | 0,
    host: string
  ]
}

interface TCPServerOptions {
  allowHalfOpen?: number
  keepAlive?: boolean
  keepAliveInitialDelay?: boolean
  noDelay?: boolean
  readBufferSize?: number
}

interface TCPServerListenOptions extends LookupOptions {
  lookup?: DNSLookup
  backlog?: number
  host?: string
  port?: number
}

declare class TCPServer<
  M extends TCPServerEvents = TCPServerEvents
> extends EventEmitter<M> {
  constructor(opts?: TCPServerOptions, onconnection?: () => void)
  constructor(onconnection: () => void)

  readonly listening: boolean

  address(): TCPSocketAddress

  listen(
    port?: number,
    host?: string,
    backlog?: number,
    opts?: TCPServerListenOptions,
    onlistening?: () => void
  ): this

  listen(
    port: number,
    host: string,
    backlog: number,
    onlistening: () => void
  ): this

  listen(port: number, host: string, onlistening: () => void): this
  listen(port: number, onlistening: () => void): this
  listen(onlistening: () => void): this

  close(onclose?: (err: Error) => void): void

  ref(): void
  unref(): void
}

declare function createConnection(
  port: number,
  host?: string,
  opts?: TCPSocketOptions & TCPSocketConnectOptions,
  onconnect?: () => void
): TCPSocket

declare function createConnection(
  port: number,
  host: string,
  onconnect: () => void
): TCPSocket

declare function createConnection(
  port: number,
  onconnect: () => void
): TCPSocket

declare function createConnection(
  opts: TCPSocketOptions & TCPSocketConnectOptions,
  onconnect: () => void
): TCPSocket

declare function createConnection(
  opts: TCPSocketOptions & TCPSocketConnectOptions
): TCPSocket

declare function createServer(
  opts?: TCPServerOptions,
  onconnection?: () => void
): TCPServer

declare function createServer(onconnection: () => void): TCPServer

declare const constants: {
  state: {
    CONNECTING: number
    CONNECTED: number
    BINDING: number
    BOUND: number
    READING: number
    CLOSING: number
    UNREFED: number
  }
}

declare class TCPError extends Error {
  readonly code: string

  static SOCKET_ALREADY_CONNECTED(msg: string): TCPError
  static SERVER_ALREADY_LISTENING(msg: string): TCPError
  static SERVER_IS_CLOSED(msg: string): TCPError
  static INVALID_HOST(msg?: string): TCPError
}

declare function isIP(host: string): IPFamily | 0

declare function isIPv4(host: string): boolean

declare function isIPv6(host: string): boolean

export {
  type TCPSocket,
  TCPSocket as Socket,
  type TCPServer,
  TCPServer as Server,
  createConnection,
  createConnection as connect,
  createServer,
  constants,
  type TCPError,
  TCPError as errors,
  type IPFamily,
  isIP,
  isIPv4,
  isIPv6,
  type TCPSocketAddress,
  type TCPSocketEvents,
  type TCPSocketOptions,
  type TCPSocketConnectOptions,
  type TCPServerEvents,
  type TCPServerOptions,
  type TCPServerListenOptions
}
