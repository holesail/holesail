#!/usr/bin/env node

const pm2 = require('pm2')
const minimist = require('minimist')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const pm2Binary = path.join(__dirname, '../node_modules', 'pm2', 'bin', 'pm2')
const holesail = path.resolve(__dirname, '../index.js')

function filterArgs (argv) {
  const filteredArgs = []
  let skipNext = false

  for (let i = 0; i < argv.length; i++) {
    if (skipNext) {
      skipNext = false
      continue
    }

    if (argv[i] === '--name') {
      skipNext = true
    } else if (argv[i].startsWith('--name=')) {
      continue
    } else {
      filteredArgs.push(argv[i])
    }
  }

  return filteredArgs
}

function createSession (args) {
  console.log(args)

  process.exit(1)
  const name = args.name || `holesail-${Date.now()}`
  const holesailArgs = filterArgs(process.argv.slice(3))

  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) return reject(`Error connecting to pm2: ${err}`)

      pm2.start({
        name,
        script: holesail,
        args: holesailArgs
      }, (err) => {
        if (err) {
          pm2.disconnect()
          return reject(`Failed to start holesail: ${err}`)
        }

        console.log(`Holesail session started with name: ${name}`)
        pm2.launchBus((err, bus) => {
          if (err) {
            console.error('Error launching log bus:', err)
            pm2.disconnect()
            return
          }

          bus.on('log:out', (packet) => {
            if (packet.process.name === name) {
              const logMessage = packet.data.replace(/^\[.*\]\s*/, '')
              console.log(logMessage)
            }
          })

          bus.on('log:err', (packet) => {
            if (packet.process.name === name) {
              const logMessage = packet.data.replace(/^\[.*\]\s*/, '')
              console.error(logMessage)
            }
          })

          setTimeout(() => {
            console.log('This holesail connection is now running in background. Run "holesail-manager" list to see all running connections.')
            pm2.disconnect()
            resolve()
          }, 5000)
        })
      })
    })
  })
}

function listSessions () {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [pm2Binary, 'list'], {
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: 'true' }
    })

    child.on('error', (err) => {
      reject(`Error listing PM2 processes: ${err}`)
    })

    child.on('exit', (code) => {
      if (code !== 0) {
        reject(`PM2 exited with code ${code}`)
      } else {
        resolve()
      }
    })
  })
}

// Similar functions for deleteSession, startSession, stopSession, viewLogs...

// Export the functions
module.exports = {
  createSession,
  listSessions
}

// CLI Entry Point
if (require.main === module) {
  const args = minimist(process.argv.slice(2))
  const command = args._[0]
  const processName = args._[1]

  switch (command) {
    case 'create':
      createSession(args).catch(console.error)
      break
    case 'list':
      listSessions().catch(console.error)
      break
      // Add cases for other commands
    default:
      console.log('Usage: holesail-manager <command> [processName] [options]')
      // Print help information...
      break
  }
}
