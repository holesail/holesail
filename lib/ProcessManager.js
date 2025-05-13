const { spawn } = require('node:child_process')
const { join } = require('node:path')
const { mkdirSync, writeFileSync, readFileSync, openSync, unlinkSync } = require('node:fs')
const { homedir } = require('node:os')

const PROCESS_DIR = join(homedir(), '.holesail', 'processes')
mkdirSync(PROCESS_DIR, { recursive: true })

class ProcessManager {
  constructor () {
    this.processFile = join(PROCESS_DIR, 'processes.json')
    this.processes = this.loadProcesses()
  }

  loadProcesses () {
    try {
      return JSON.parse(readFileSync(this.processFile, 'utf8'))
    } catch {
      return {}
    }
  }

  saveProcesses () {
    writeFileSync(this.processFile, JSON.stringify(this.processes, null, 2))
  }

  create ({ name, script, args }) {
    const logFile = join(PROCESS_DIR, `${name}.log`)
    const pidFile = join(PROCESS_DIR, `${name}.pid`)

    const out = openSync(logFile, 'a')
    const err = openSync(logFile, 'a')

    const child = spawn(script, args, {
      detached: true,
      stdio: ['ignore', out, err]
    })

    writeFileSync(pidFile, child.pid.toString())

    this.processes[name] = {
      pid: child.pid,
      script,
      args,
      logFile,
      pidFile,
      status: 'running'
    }

    this.saveProcesses()
    child.unref()

    return { pid: child.pid }
  }

  list () {
    return Object.entries(this.processes).map(([name, proc]) => ({
      name,
      ...proc
    }))
  }

  delete (name) {
    if (this.processes[name]) {
      try {
        process.kill(this.processes[name].pid)
      } catch (e) {
        // Process might not exist anymore
      }

      try {
        unlinkSync(this.processes[name].logFile)
        unlinkSync(this.processes[name].pidFile)
      } catch (e) {
        // Files might not exist
      }

      delete this.processes[name]
      this.saveProcesses()
    }
  }

  stop (name) {
    if (this.processes[name] && this.processes[name].status === 'running') {
      try {
        process.kill(this.processes[name].pid, 'SIGTERM')
        this.processes[name].status = 'stopped'
        this.saveProcesses()
      } catch (e) {
        throw new Error(`Failed to stop process ${name}`)
      }
    }
  }

  start (name) {
    if (this.processes[name] && this.processes[name].status === 'stopped') {
      const { script, args } = this.processes[name]
      this.delete(name)
      return this.create({ name, script, args })
    }
  }

  logs (name) {
    if (this.processes[name]) {
      const logFile = this.processes[name].logFile
      try {
        return readFileSync(logFile, 'utf8')
      } catch (e) {
        return `No logs found for ${name}`
      }
    }
    return `Process ${name} not found`
  }
}

module.exports = ProcessManager