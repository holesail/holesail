import EventEmitter, { EventMap } from 'bare-events'
import {
  platform,
  arch,
  cpuUsage,
  threadCpuUsage,
  resourceUsage,
  memoryUsage
} from 'bare-os'
import { ReadStream } from 'bare-tty'
import Pipe from 'bare-pipe'
import hrtime from 'bare-hrtime'

interface ProcessEvents extends EventMap {
  beforeExit: [code: number]
  exit: [code: number]
  idle: []
  resume: []
  suspend: [linger: number]
  uncaughtException: [err: unknown]
  unhandledRejection: [reason: unknown, promise: Promise<unknown>]

  SIGBREAK: []
  SIGHUP: []
  SIGINT: []
  SIGPIPE: []
  SIGTERM: []
  SIGWINCH: []
}

interface Process<M extends ProcessEvents = ProcessEvents>
  extends EventEmitter<M> {
  readonly stdin: ReadStream | Pipe
  readonly stdout: ReadStream | Pipe
  readonly stderr: ReadStream | Pipe

  readonly arch: ReturnType<typeof arch>
  readonly argv: string[]
  readonly env: Record<string, string>
  readonly execPath: string
  readonly hrtime: typeof hrtime
  readonly pid: number
  readonly platform: ReturnType<typeof platform>
  readonly ppid: number
  readonly version: string
  readonly versions: Record<string, string>

  exitCode: number
  title: string

  exit(code?: number): never

  suspend(): void
  resume(): void

  cwd(): string
  chdir(dir: string): string

  kill(pid: number, signal?: string | number): void

  uptime(): number

  cpuUsage: typeof cpuUsage
  threadCpuUsage: typeof threadCpuUsage
  resourceUsage: typeof resourceUsage
  memoryUsage: typeof memoryUsage

  nextTick<T extends unknown[]>(cb: (...args: T) => unknown, ...args: T): void
}

declare let process: Process

declare namespace process {
  export { type ProcessEvents }
}

export = process
