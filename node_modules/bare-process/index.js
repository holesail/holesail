const EventEmitter = require('bare-events')
const Pipe = require('bare-pipe')
const Signal = require('bare-signals')
const tty = require('bare-tty')
const os = require('bare-os')
const env = require('bare-env')
const hrtime = require('bare-hrtime')

let stdin = null
let stdout = null
let stderr = null

class Process extends EventEmitter {
  constructor() {
    super()

    this._startTime = hrtime.bigint()

    EventEmitter.forward(Bare, this, [
      'uncaughtException',
      'unhandledRejection',
      'beforeExit',
      'exit',
      'suspend',
      'idle',
      'resume'
    ])

    const signals = new Signal.Emitter()

    signals.unref()

    EventEmitter.forward(signals, this, [
      'SIGTERM',
      'SIGINT',
      'SIGPIPE',
      'SIGHUP',
      'SIGBREAK',
      'SIGWINCH'
    ])
  }

  get stdin() {
    if (stdin === null) {
      stdin = tty.isTTY(0)
        ? new tty.ReadStream(0)
        : new Pipe(0, { eagerOpen: false })
      stdin.fd = 0
    }

    return stdin
  }

  get stdout() {
    if (stdout === null) {
      stdout = tty.isTTY(1)
        ? new tty.WriteStream(1)
        : new Pipe(1, { eagerOpen: false })
      stdout.fd = 1
    }

    return stdout
  }

  get stderr() {
    if (stderr === null) {
      stderr = tty.isTTY(2)
        ? new tty.WriteStream(2)
        : new Pipe(2, { eagerOpen: false })
      stderr.fd = 2
    }

    return stderr
  }

  get platform() {
    return os.platform()
  }

  get arch() {
    return os.arch()
  }

  get title() {
    return os.getProcessTitle()
  }

  set title(title) {
    os.setProcessTitle(title)
  }

  get pid() {
    return os.pid()
  }

  get ppid() {
    return os.ppid()
  }

  get argv() {
    return Bare.argv
  }

  get execPath() {
    return os.execPath()
  }

  get exitCode() {
    return Bare.exitCode
  }

  set exitCode(code) {
    Bare.exitCode = code
  }

  get version() {
    return Bare.version
  }

  get versions() {
    return Bare.versions
  }

  get env() {
    return env
  }

  get hrtime() {
    return hrtime
  }

  exit(code) {
    Bare.exit(code)
  }

  suspend() {
    Bare.suspend()
  }

  resume() {
    Bare.resume()
  }

  cwd() {
    return os.cwd()
  }

  chdir(directory) {
    os.chdir(directory)
  }

  kill(pid, signal) {
    os.kill(pid, signal)
  }

  uptime() {
    return Number(hrtime.bigint() - this._startTime) / 1e9
  }

  cpuUsage(previous) {
    return os.cpuUsage(previous)
  }

  threadCpuUsage(previous) {
    return os.threadCpuUsage(previous)
  }

  resourceUsage() {
    return os.resourceUsage()
  }

  memoryUsage() {
    return os.memoryUsage()
  }

  nextTick(cb, ...args) {
    queueMicrotask(cb.bind(null, ...args))
  }

  [Symbol.for('bare.inspect')]() {
    return {
      __proto__: { constructor: Process },

      platform: this.platform,
      arch: this.arch,
      title: this.title,
      pid: this.pid,
      ppid: this.ppid,
      argv: this.argv,
      execPath: this.execPath,
      exitCode: this.exitCode,
      version: this.version,
      versions: this.versions,
      env: this.env
    }
  }
}

module.exports = new Process()
