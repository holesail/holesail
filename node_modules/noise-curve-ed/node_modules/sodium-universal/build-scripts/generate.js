#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const root = path.dirname(require.resolve('sodium-javascript/package.json'))

const tmp = "module.exports = require('sodium-native')\n"

function recurse (dir) {
  const ls = fs.readdirSync(dir)
  const subdir = path.relative(root, dir)
  if (subdir) fs.mkdirSync(subdir, { recursive: true })

  for (const file of ls) {
    if (file === 'internal') recurse(path.join(dir, file))
    if (!/\.js$/i.test(file)) continue
    if (file === 'example.js') continue
    if (file === 'test.js') continue

    fs.writeFileSync(path.join(__dirname, '..', subdir, file), tmp)
  }
}

recurse(root)

const pkg = require('sodium-javascript/package.json')
const myPkg = require('../package.json')

for (const key of Object.keys(pkg.dependencies)) {
  myPkg.dependencies[key] = pkg.dependencies[key]
}

fs.writeFileSync(path.join(__dirname, '../package.json'), JSON.stringify(myPkg, null, 2) + '\n')
