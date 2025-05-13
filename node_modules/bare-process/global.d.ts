import process from '.'

type Process = typeof process

declare global {
  const process: Process
}
