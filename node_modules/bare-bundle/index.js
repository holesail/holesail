class MemoryFile {
  constructor(data, opts = {}) {
    const { executable = false, mode = executable ? 0o755 : 0o644 } = opts

    this._data = typeof data === 'string' ? Buffer.from(data) : data
    this._mode = mode
  }

  size() {
    return this._data.byteLength
  }

  mode() {
    return this._mode
  }

  read() {
    return this._data
  }

  inspect() {
    return {
      __proto__: { constructor: MemoryFile },

      data: this._data,
      mode: this._mode.toString(8)
    }
  }

  [Symbol.for('bare.inspect')]() {
    return this.inspect()
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.inspect()
  }
}

module.exports = exports = class Bundle {
  static get version() {
    return 0
  }

  constructor(opts = {}) {
    const { File = MemoryFile } = opts

    this._File = File
    this._id = null
    this._main = null
    this._imports = {}
    this._resolutions = {}
    this._addons = []
    this._assets = []
    this._files = new Map()
  }

  get version() {
    return Bundle.version
  }

  get id() {
    return this._id
  }

  set id(value) {
    if (typeof value !== 'string' && value !== null) {
      throw new TypeError(
        `ID must be a string or null. Received type ${typeof value} (${value})`
      )
    }

    this._id = value
  }

  get main() {
    return this._main
  }

  set main(value) {
    if (typeof value !== 'string' && value !== null) {
      throw new TypeError(
        `Main must be a string or null. Received type ${typeof value} (${value})`
      )
    }

    this._main = value
  }

  get imports() {
    return this._imports
  }

  set imports(value) {
    this._imports = cloneImportsMap(value)
  }

  get resolutions() {
    return this._resolutions
  }

  set resolutions(value) {
    this._resolutions = cloneResolutionsMap(value)
  }

  get addons() {
    return this._addons
  }

  set addons(value) {
    this._addons = cloneFilesList(value, 'Addons')
  }

  get assets() {
    return this._assets
  }

  set assets(value) {
    this._assets = cloneFilesList(value, 'Assets')
  }

  get files() {
    return Object.fromEntries(this._files.entries())
  }

  *[Symbol.iterator]() {
    for (const [key, file] of this._files) {
      yield [key, file.read(), file.mode()]
    }
  }

  keys() {
    return this._files.keys()
  }

  exists(key) {
    return this._files.has(key)
  }

  size(key) {
    const file = this._files.get(key) || null
    if (file === null) return 0
    return file.size()
  }

  mode(key) {
    const file = this._files.get(key) || null
    if (file === null) return 0
    return file.mode()
  }

  read(key) {
    const file = this._files.get(key) || null
    if (file === null) return null
    return file.read()
  }

  write(key, data, opts = {}) {
    if (typeof key !== 'string') {
      throw new TypeError(
        `File path must be a string. Received type ${typeof key} (${key})`
      )
    }

    const {
      main = false,
      alias = null,
      imports = null,
      addon = false,
      asset = false
    } = opts

    this._files.set(key, new MemoryFile(data, opts))

    if (main) this._main = key
    if (alias) this._imports[alias] = key
    if (imports) this._resolutions[key] = cloneImportsMap(imports)
    if (addon) this._addons.push(key)
    if (asset) this._assets.push(key)

    return this
  }

  mount(root, opts = {}) {
    const bundle = new Bundle()

    // Go through the private API properties as we're operating on already
    // validated values.

    bundle._File = this._File
    bundle._id = this._id

    if (this._main) bundle._main = mountSpecifier(this._main, root)

    bundle._imports = transformImportsMap(
      this._imports,
      root,
      null,
      opts,
      mountSpecifier
    )
    bundle._resolutions = transformResolutionsMap(
      this._resolutions,
      root,
      opts,
      mountSpecifier
    )

    for (const [key, file] of this._files) {
      bundle._files.set(mountSpecifier(key, root), file)
    }

    bundle._addons = transformFilesList(this._addons, root, mountSpecifier)
    bundle._assets = transformFilesList(this._assets, root, mountSpecifier)

    return bundle
  }

  unmount(root, opts = {}) {
    const bundle = new Bundle()

    // Go through the private API properties as we're operating on already
    // validated values.

    bundle._File = this._File
    bundle._id = this._id

    if (this._main) bundle._main = unmountSpecifier(this._main, root)

    bundle._imports = transformImportsMap(
      this._imports,
      root,
      null,
      opts,
      unmountSpecifier
    )
    bundle._resolutions = transformResolutionsMap(
      this._resolutions,
      root,
      opts,
      unmountSpecifier
    )

    for (const [key, file] of this._files) {
      bundle._files.set(unmountSpecifier(key, root), file)
    }

    bundle._addons = transformFilesList(this._addons, root, unmountSpecifier)
    bundle._assets = transformFilesList(this._assets, root, unmountSpecifier)

    return bundle
  }

  toBuffer(opts = {}) {
    const { indent = 0 } = opts

    const header = {
      version: Bundle.version,
      id: this._id,
      main: this._main,
      imports: cloneImportsMap(this._imports),
      resolutions: cloneResolutionsMap(this._resolutions),
      addons: cloneFilesList(this._addons, 'Addons'),
      assets: cloneFilesList(this._assets, 'Assets'),
      files: {}
    }

    const keys = [...this._files.keys()].sort()

    let offset = 0

    for (const key of keys) {
      const length = this.size(key)

      header.files[key] = { offset, length, mode: this.mode(key) }
      offset += length
    }

    const json = Buffer.from(`\n${JSON.stringify(header, null, indent)}\n`)

    const len = Buffer.from(json.byteLength.toString(10))

    const buffer = Buffer.alloc(len.byteLength + json.byteLength + offset)

    offset = 0

    buffer.set(len, offset)
    offset += len.byteLength

    buffer.set(json, offset)
    offset += json.byteLength

    for (const key of keys) {
      buffer.set(this.read(key), offset)
      offset += this.size(key)
    }

    return buffer
  }

  inspect() {
    return {
      __proto__: { constructor: Bundle },

      version: this.version,
      id: this.id,
      main: this.main,
      imports: this.imports,
      resolutions: this.resolutions,
      addons: this.addons,
      assets: this.assets,
      files: this.files
    }
  }

  [Symbol.for('bare.inspect')]() {
    return this.inspect()
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.inspect()
  }
}

const Bundle = exports

exports.isBundle = function isBundle(value) {
  return value instanceof Bundle
}

exports.from = function from(value) {
  // from(string)
  if (typeof value === 'string') return fromString(value)

  // from(buffer)
  if (Buffer.isBuffer(value)) return fromBuffer(value)

  // from(bundle)
  return value
}

function fromString(string) {
  return fromBuffer(Buffer.from(string))
}

function fromBuffer(buffer) {
  if (buffer[0] === 0x23 /* # */ && buffer[1] === 0x21 /* ! */) {
    let end = 2

    while (buffer[end] !== 0xa /* \n */) end++

    buffer = buffer.subarray(end + 1)
  }

  let end = 0

  while (isDecimal(buffer[end])) end++

  const len = parseInt(buffer.toString('utf8', 0, end), 10)

  const header = JSON.parse(buffer.toString('utf8', end, end + len))

  const bundle = new Bundle()

  // Go through the public API setters to ensure that the header fields are
  // validated.

  if (header.id) bundle.id = header.id
  if (header.main) bundle.main = header.main
  if (header.imports) bundle.imports = header.imports
  if (header.resolutions) bundle.resolutions = header.resolutions
  if (header.addons) bundle.addons = header.addons
  if (header.assets) bundle.assets = header.assets

  let offset = end + len

  for (const [file, info] of Object.entries(header.files)) {
    bundle.write(file, buffer.subarray(offset, offset + info.length), {
      mode: info.mode || 0o644
    })

    offset += info.length
  }

  return bundle
}

function isDecimal(c) {
  return c >= 0x30 && c <= 0x39
}

function compareKeys([a], [b]) {
  return a > b ? 1 : a < b ? -1 : 0
}

function cloneImportsMap(value) {
  if (typeof value === 'object' && value !== null) {
    const imports = {}

    for (const entry of Object.entries(value).sort(compareKeys)) {
      imports[entry[0]] = cloneImportsMapEntry(entry[1])
    }

    return imports
  }

  throw new TypeError(
    `Imports map must be an object. Received type ${typeof value} (${value})`
  )
}

function cloneImportsMapEntry(value) {
  if (typeof value === 'string') return value

  if (typeof value === 'object' && value !== null) {
    const imports = {}

    for (const entry of Object.entries(value)) {
      imports[entry[0]] = cloneImportsMapEntry(entry[1])
    }

    return imports
  }

  throw new TypeError(
    `Imports map entry must be a string or object. Received type ${typeof value} (${value})`
  )
}

function cloneResolutionsMap(value) {
  if (typeof value === 'object' && value !== null) {
    const resolutions = {}

    for (const entry of Object.entries(value).sort(compareKeys)) {
      resolutions[entry[0]] = cloneImportsMap(entry[1])
    }

    return resolutions
  }

  throw new TypeError(
    `Resolutions map must be an object. Received type ${typeof value} (${value})`
  )
}

function cloneFilesList(value, name) {
  if (Array.isArray(value)) {
    const files = []

    for (const entry of value) {
      if (typeof entry !== 'string') {
        throw new TypeError(
          `${name} entry must be a string. Received type ${typeof entry} (${entry})`
        )
      }

      files.push(entry)
    }

    return files.sort()
  }

  throw new TypeError(
    `${name} list must be an array. Received type ${typeof value} (${value})`
  )
}

function transformImportsMap(value, root, conditionalRoot, opts, fn) {
  const { conditions = {} } = opts

  const imports = {}

  for (const entry of Object.entries(value)) {
    const condition = entry[0]

    imports[condition] = transformImportsMapEntry(
      entry[1],
      root,
      conditionalRoot || conditions[condition],
      opts,
      fn
    )
  }

  return imports
}

function transformImportsMapEntry(value, root, conditionalRoot, opts, fn) {
  const { conditions = {} } = opts

  if (typeof value === 'string')
    return fn(value, conditionalRoot || conditions.default || root)

  return transformImportsMap(value, root, conditionalRoot, opts, fn)
}

function transformResolutionsMap(value, root, opts, fn) {
  const resolutions = {}

  for (const entry of Object.entries(value)) {
    resolutions[fn(entry[0], root)] = transformImportsMap(
      entry[1],
      root,
      null,
      opts,
      fn
    )
  }

  return resolutions
}

function transformFilesList(value, root, fn) {
  const files = []

  for (const entry of value) {
    files.push(fn(entry, root))
  }

  return files
}

function mountSpecifier(specifier, root) {
  if (startsWithWindowsDriveLetter(specifier)) {
    specifier = '/' + specifier
  }

  if (specifier[0] === '/' || specifier[0] === '\\') {
    specifier = '.' + specifier
  }

  if (specifier.startsWith('./') || specifier.startsWith('.\\')) {
    return new URL(specifier, root).href
  }

  return specifier
}

function unmountSpecifier(specifier, root) {
  specifier = new URL(specifier)

  if (typeof root === 'string') root = new URL(root)

  if (
    specifier.protocol !== root.protocol ||
    specifier.host !== root.host ||
    specifier.port !== root.port
  ) {
    return specifier.href
  }

  const specifierPath = splitPath(specifier.pathname)
  const rootPath = splitPath(root.pathname)

  while (specifierPath.length > 0 && rootPath[0] === specifierPath[0]) {
    specifierPath.shift()
    rootPath.shift()
  }

  rootPath.fill('..')

  return '/' + rootPath.concat(specifierPath).join('/')
}

function splitPath(path) {
  const parts = path.split('/')

  if (!parts[0]) parts.shift()
  if (!parts[parts.length - 1]) parts.pop()

  return parts
}

// https://infra.spec.whatwg.org/#ascii-upper-alpha
function isASCIIUpperAlpha(c) {
  return c >= 0x41 && c <= 0x5a
}

// https://infra.spec.whatwg.org/#ascii-lower-alpha
function isASCIILowerAlpha(c) {
  return c >= 0x61 && c <= 0x7a
}

// https://infra.spec.whatwg.org/#ascii-alpha
function isASCIIAlpha(c) {
  return isASCIIUpperAlpha(c) || isASCIILowerAlpha(c)
}

// https://url.spec.whatwg.org/#windows-drive-letter
function isWindowsDriveLetter(input) {
  return (
    input.length >= 2 &&
    isASCIIAlpha(input.charCodeAt(0)) &&
    (input.charCodeAt(1) === 0x3a || input.charCodeAt(1) === 0x7c)
  )
}

// https://url.spec.whatwg.org/#start-with-a-windows-drive-letter
function startsWithWindowsDriveLetter(input) {
  return (
    input.length >= 2 &&
    isWindowsDriveLetter(input) &&
    (input.length === 2 ||
      input.charCodeAt(2) === 0x2f ||
      input.charCodeAt(2) === 0x5c ||
      input.charCodeAt(2) === 0x3f ||
      input.charCodeAt(2) === 0x23)
  )
}
