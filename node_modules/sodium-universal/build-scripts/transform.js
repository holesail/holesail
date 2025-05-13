const fs = require('fs')
const path = require('path')
const { Transform, PassThrough } = require('stream')

module.exports = function (file, opts) {
  const basedir = path.resolve(__dirname, '..')
  const relname = path.relative(basedir, file)

  if (opts._flags.browserField === false) {
    return new PassThrough()
  }

  return new Transform({
    transform (data, enc, cb) {
      cb()
    },
    flush (cb) {
      const filename = require.resolve('sodium-javascript/' + relname)
      fs.readFile(filename, (err, buf) => {
        if (err) return cb(err)
        this.push(buf)
        cb(null)
      })
    }
  })
}
