/* global Bare */
const path = require('bare-path')
const resolve = require('bare-module-resolve')
const lex = require('bare-module-lexer')
const { isURL, fileURLToPath, pathToFileURL } = require('bare-url')
const Bundle = require('bare-bundle')
const Protocol = require('./lib/protocol')
const constants = require('./lib/constants')
const errors = require('./lib/errors')
const binding = require('./binding')

const isWindows = Bare.platform === 'win32'

const { startsWithWindowsDriveLetter } = resolve

module.exports = exports = class Module {
  constructor(url) {
    this._url = url
    this._state = 0
    this._type = 0
    this._defaultType = this._type
    this._cache = null
    this._main = null
    this._exports = null
    this._imports = null
    this._resolutions = null
    this._builtins = null
    this._conditions = null
    this._protocol = null
    this._bundle = null
    this._function = null
    this._names = null
    this._handle = null

    Object.preventExtensions(this)

    Module._modules.add(this)
  }

  get url() {
    return this._url
  }

  get filename() {
    return urlToPath(this._url)
  }

  get dirname() {
    return urlToDirname(this._url)
  }

  get type() {
    return this._type
  }

  get defaultType() {
    return this._defaultType
  }

  get cache() {
    return this._cache
  }

  get main() {
    return this._main
  }

  get exports() {
    return this._exports
  }

  set exports(value) {
    this._exports = value
  }

  get imports() {
    return this._imports
  }

  get resolutions() {
    return this._resolutions
  }

  get builtins() {
    return this._builtins
  }

  get conditions() {
    return Array.from(this._conditions)
  }

  get protocol() {
    return this._protocol
  }

  // For Node.js compatibility
  get id() {
    return this.filename
  }

  // For Node.js compatibility
  get path() {
    return this.dirname
  }

  destroy() {
    this._state |= constants.states.DESTROYED

    if (this._handle) {
      binding.deleteModule(this._handle)
      this._handle = null
    }

    Module._modules.delete(this)
  }

  _transform(isImport, isDynamicImport) {
    if (isDynamicImport) {
      this._run()
    } else if (isImport) {
      this._synthesize()
    } else {
      this._evaluate()
    }

    return this
  }

  _synthesize() {
    if ((this._state & constants.states.SYNTHESIZED) !== 0) return

    this._state |= constants.states.SYNTHESIZED

    if (this._type === constants.types.MODULE) return

    const names = new Set(['default'])
    const queue = [this]
    const seen = new Set()

    while (queue.length) {
      const module = queue.pop()

      if (seen.has(module)) continue

      seen.add(module)

      switch (module._type) {
        case constants.types.SCRIPT: {
          const result = lex(module._function.toString())

          for (const { name } of result.exports) names.add(name)

          const referrer = module

          for (const { specifier, type } of result.imports) {
            if (
              (type & lex.constants.REEXPORT) !== 0 &&
              (type & lex.constants.ADDON) === 0 &&
              (type & lex.constants.ASSET) === 0
            ) {
              const resolved = Module.resolve(specifier, referrer._url, {
                isImport: true,
                referrer
              })

              const module = Module.load(resolved, {
                isImport: true,
                referrer
              })

              if (module._names) {
                for (const name of module._names) names.add(name)
              } else {
                queue.push(module)
              }
            }
          }

          break
        }

        case constants.types.MODULE:
          module._evaluate()

          for (const name of Object.keys(module._exports)) names.add(name)

          break

        case constants.types.JSON:
          for (const name of Object.keys(module._exports)) names.add(name)
      }
    }

    this._names = Array.from(names)

    this._handle = binding.createSyntheticModule(
      this._url.href,
      this._names,
      Module._handle
    )
  }

  _evaluate() {
    if ((this._state & constants.states.EVALUATED) !== 0) return

    this._state |= constants.states.EVALUATED

    if (this._type === constants.types.SCRIPT) {
      const require = createRequire(this._url, { module: this })

      this._exports = {}

      const fn = this._function // Bind to variable to ensure proper stack trace

      fn(
        require,
        this,
        this._exports,
        urlToPath(this._url),
        urlToDirname(this._url)
      )
    } else if (this._type === constants.types.MODULE) {
      this._run()

      this._exports = binding.getNamespace(this._handle)
    }
  }

  _run() {
    if ((this._state & constants.states.RUN) !== 0) return

    this._state |= constants.states.RUN

    this._synthesize()

    binding.runModule(this._handle, Module._handle, Module._onrun)
  }

  [Symbol.for('bare.inspect')]() {
    return {
      __proto__: { constructor: Module },

      url: this.url,
      type: this.type,
      defaultType: this.defaultType,
      main: this.main,
      exports: this.exports,
      imports: this.imports,
      resolutions: this.resolutions,
      builtins: this.builtins,
      conditions: this.conditions
    }
  }

  static _extensions = Object.create(null)
  static _protocol = null
  static _cache = module.cache || Object.create(null)
  static _modules = new Set()
  static _conditions = ['bare', 'node', Bare.platform, Bare.arch]

  static _handle = binding.init(
    this,
    this._onimport,
    this._onevaluate,
    this._onmeta
  )

  static _onimport(specifier, attributes, referrerHref, isDynamicImport) {
    const referrer = this._cache[referrerHref] || null

    if (referrer === null) {
      throw errors.MODULE_NOT_FOUND(
        `Cannot find referrer for module '${specifier}' imported from '${referrerHref}'`
      )
    }

    const resolved = this.resolve(specifier, referrer._url, {
      isImport: true,
      referrer,
      attributes
    })

    const module = this.load(resolved, {
      isImport: true,
      isDynamicImport,
      referrer,
      attributes
    })

    return module._handle
  }

  static _onevaluate(href) {
    const module = this._cache[href] || null

    if (module === null) {
      throw errors.MODULE_NOT_FOUND(`Cannot find module '${href}'`)
    }

    module._evaluate()

    for (const name of module._names) {
      let value

      if (
        name === 'default' &&
        (typeof module._exports !== 'object' ||
          module._exports === null ||
          name in module._exports === false)
      ) {
        value = module._exports
      } else {
        value = module._exports[name]
      }

      binding.setExport(module._handle, name, value)
    }
  }

  static _onmeta(href, meta) {
    const self = Module

    const module = this._cache[href] || null

    if (module === null) {
      throw errors.MODULE_NOT_FOUND(`Cannot find module '${href}'`)
    }

    const referrer = module

    meta.url = module._url.href
    meta.main = module._main === module
    meta.cache = module._cache

    meta.resolve = function resolve(specifier, parentURL = referrer._url) {
      return self.resolve(specifier, toURL(parentURL, referrer._url), {
        referrer
      }).href
    }

    meta.addon = function addon(specifier = '.', parentURL = referrer._url) {
      const resolved = Bare.Addon.resolve(
        specifier,
        toURL(parentURL, referrer._url),
        { referrer }
      )

      const addon = Bare.Addon.load(resolved, { referrer })

      return addon._exports
    }

    meta.addon.resolve = function resolve(
      specifier = '.',
      parentURL = referrer._url
    ) {
      return Bare.Addon.resolve(specifier, toURL(parentURL, referrer._url), {
        referrer
      }).href
    }

    meta.addon.host = Bare.Addon.host

    meta.asset = function asset(specifier, parentURL = referrer._url) {
      return self.asset(specifier, toURL(parentURL, referrer._url), {
        referrer
      }).href
    }
  }

  static _onrun(reason, promise, err = reason) {
    if (err) {
      promise.catch(() => {}) // Don't leak the rejection

      throw err
    } else {
      promise.catch((err) =>
        queueMicrotask(() => {
          throw err
        })
      )
    }
  }

  static get protocol() {
    return this._protocol
  }

  static get cache() {
    return this._cache
  }

  static load(url, source = null, opts = {}) {
    const self = Module

    if (
      !ArrayBuffer.isView(source) &&
      !Bundle.isBundle(source) &&
      typeof source !== 'string' &&
      source !== null
    ) {
      opts = source
      source = null
    }

    const {
      isImport = false,
      isDynamicImport = false,

      referrer = null,
      attributes,
      type = typeForAttributes(attributes),
      defaultType = referrer ? referrer._defaultType : 0,
      cache = referrer ? referrer._cache : self._cache,
      main = referrer ? referrer._main : null,
      protocol = referrer ? referrer._protocol : self._protocol,
      imports = referrer ? referrer._imports : null,
      resolutions = referrer ? referrer._resolutions : null,
      builtins = referrer ? referrer._builtins : null,
      conditions = referrer ? referrer._conditions : self._conditions
    } = opts

    let module = cache[url.href] || null

    if (module !== null) {
      if (type !== 0 && type !== module._type) {
        throw errors.TYPE_INCOMPATIBLE(
          `Module '${module.url.href}' is not of type '${nameOfType(type)}'`
        )
      }

      return module._transform(isImport, isDynamicImport)
    }

    module = cache[url.href] = new Module(url)

    try {
      switch (url.protocol) {
        case 'builtin:':
          module._exports = builtins[url.pathname]
          break

        default: {
          module._defaultType = defaultType
          module._cache = cache
          module._main = main || module
          module._protocol = protocol
          module._imports = imports
          module._resolutions = resolutions
          module._builtins = builtins
          module._conditions = conditions

          let extension =
            canonicalExtensionForType(type) || path.extname(url.pathname)

          if (extension in self._extensions === false) {
            if (defaultType) {
              extension = canonicalExtensionForType(defaultType) || '.js'
            } else {
              extension = '.js'
            }
          }

          self._extensions[extension](module, source, referrer)
        }
      }

      return module._transform(isImport, isDynamicImport)
    } catch (err) {
      delete cache[url.href]

      throw err
    }
  }

  static resolve(specifier, parentURL, opts = {}) {
    const self = Module

    if (typeof specifier !== 'string') {
      throw new TypeError(
        `Specifier must be a string. Received type ${typeof specifier} (${specifier})`
      )
    }

    const {
      isImport = false,

      referrer = null,
      attributes,
      type = typeForAttributes(attributes),
      extensions = extensionsForType(type),
      protocol = referrer ? referrer._protocol : self._protocol,
      imports = referrer ? referrer._imports : null,
      resolutions = referrer ? referrer._resolutions : null,
      builtins = referrer ? referrer._builtins : null,
      conditions = referrer ? referrer._conditions : self._conditions
    } = opts

    const resolved = protocol.preresolve(specifier, parentURL)

    const [resolution] = protocol.resolve(resolved, parentURL, imports)

    if (resolution) return protocol.postresolve(resolution)

    const candidates = []

    for (const resolution of resolve(
      resolved,
      parentURL,
      {
        conditions: isImport
          ? ['import', ...conditions]
          : ['require', ...conditions],
        imports,
        resolutions,
        extensions,
        builtins: builtins ? Object.keys(builtins) : [],
        engines: Bare.versions
      },
      readPackage
    )) {
      candidates.push(resolution)

      switch (resolution.protocol) {
        case 'builtin:':
          return resolution
        default:
          if (protocol.exists(resolution, type)) {
            return protocol.postresolve(resolution)
          }
      }
    }

    let message = `Cannot find module '${specifier}' imported from '${parentURL.href}`

    if (candidates.length > 0) {
      message += '\nCandidates:'
      message += '\n' + candidates.map((url) => '- ' + url.href).join('\n')
    }

    throw errors.MODULE_NOT_FOUND(message, candidates)

    function readPackage(packageURL) {
      if (protocol.exists(packageURL, constants.types.JSON)) {
        return Module.load(packageURL, { protocol })._exports
      }

      return null
    }
  }

  static asset(specifier, parentURL, opts = {}) {
    const self = Module

    if (typeof specifier !== 'string') {
      throw new TypeError(
        `Specifier must be a string. Received type ${typeof specifier} (${specifier})`
      )
    }

    const {
      referrer = null,
      protocol = referrer ? referrer._protocol : self._protocol,
      imports = referrer ? referrer._imports : null,
      resolutions = referrer ? referrer._resolutions : null,
      conditions = referrer ? referrer._conditions : self._conditions
    } = opts

    const resolved = protocol.preresolve(specifier, parentURL)

    const [resolution] = protocol.resolve(resolved, parentURL, imports)

    if (resolution) return protocol.postresolve(resolution)

    for (const resolution of resolve(
      resolved,
      parentURL,
      {
        conditions: ['asset', ...conditions],
        imports,
        resolutions,
        engines: Bare.versions
      },
      readPackage
    )) {
      if (protocol.exists(resolution, constants.types.ASSET)) {
        return protocol.postresolve(
          protocol.asset ? protocol.asset(resolution) : resolution
        )
      }
    }

    throw errors.ASSET_NOT_FOUND(
      `Cannot find asset '${specifier}' imported from '${parentURL.href}'`
    )

    function readPackage(packageURL) {
      if (protocol.exists(packageURL, constants.types.JSON)) {
        return Module.load(packageURL, { protocol })._exports
      }

      return null
    }
  }
}

const Module = exports

function extensionsForType(type) {
  switch (type) {
    case constants.types.SCRIPT:
      return ['.js', '.cjs']
    case constants.types.MODULE:
      return ['.js', '.mjs']
    case constants.types.JSON:
      return ['.json']
    case constants.types.BUNDLE:
      return ['.json']
    case constants.types.ADDON:
      return ['.bare', '.node']
    case constants.types.BINARY:
      return ['.bin']
    case constants.types.TEXT:
      return ['.txt']
    default:
      return ['.js', '.cjs', '.mjs', '.json', '.bare', '.node']
  }
}

function canonicalExtensionForType(type) {
  switch (type) {
    case constants.types.SCRIPT:
      return '.cjs'
    case constants.types.MODULE:
      return '.esm'
    case constants.types.JSON:
      return '.json'
    case constants.types.BUNDLE:
      return '.bundle'
    case constants.types.ADDON:
      return '.bare'
    case constants.types.BINARY:
      return '.bin'
    case constants.types.TEXT:
      return '.txt'
    default:
      return null
  }
}

function nameOfType(type) {
  switch (type) {
    case constants.types.SCRIPT:
      return 'script'
    case constants.types.MODULE:
      return 'module'
    case constants.types.JSON:
      return 'json'
    case constants.types.BUNDLE:
      return 'bundle'
    case constants.types.ADDON:
      return 'bare'
    case constants.types.BINARY:
      return 'binary'
    case constants.types.TEXT:
      return 'text'
    default:
      return null
  }
}

function typeForAttributes(attributes) {
  if (typeof attributes !== 'object' || attributes === null) return 0

  switch (attributes.type) {
    case 'script':
      return constants.types.SCRIPT
    case 'module':
      return constants.types.MODULE
    case 'json':
      return constants.types.JSON
    case 'bundle':
      return constants.types.BUNDLE
    case 'addon':
      return constants.types.ADDON
    case 'binary':
      return constants.types.BINARY
    case 'text':
      return constants.types.TEXT
    default:
      return 0
  }
}

exports.Protocol = Protocol
exports.Bundle = Bundle

exports.constants = constants

// For Node.js compatibility
exports.builtinModules = []

// For Node.js compatibility
exports.isBuiltin = function isBuiltin() {
  return false
}

const createRequire = (exports.createRequire = function createRequire(
  parentURL,
  opts = {}
) {
  const self = Module

  let {
    module = null,

    referrer = null,
    type = constants.types.SCRIPT,
    defaultType = referrer ? referrer._defaultType : constants.types.SCRIPT,
    cache = referrer ? referrer._cache : self._cache,
    main = referrer ? referrer._main : null,
    protocol = referrer ? referrer._protocol : self._protocol,
    imports = referrer ? referrer._imports : null,
    resolutions = referrer ? referrer._resolutions : null,
    builtins = referrer ? referrer._builtins : null,
    conditions = referrer ? referrer._conditions : self._conditions
  } = opts

  if (module === null) {
    module = new Module(toURL(parentURL))

    module._type = type
    module._defaultType = defaultType
    module._cache = cache
    module._main = main || module
    module._protocol = protocol
    module._imports = imports
    module._resolutions = resolutions
    module._builtins = builtins
    module._conditions = conditions
  }

  referrer = module

  function require(specifier, opts = {}) {
    const attributes = opts && opts.with

    const resolved = self.resolve(specifier, referrer._url, {
      referrer,
      attributes
    })

    const module = self.load(resolved, { referrer, attributes })

    return module._exports
  }

  require.main = module._main
  require.cache = module._cache

  require.resolve = function resolve(specifier, parentURL = referrer._url) {
    return urlToPath(
      self.resolve(specifier, toURL(parentURL, referrer._url), { referrer })
    )
  }

  require.addon = function addon(specifier = '.', parentURL = referrer._url) {
    const resolved = Bare.Addon.resolve(
      specifier,
      toURL(parentURL, referrer._url),
      { referrer }
    )

    const addon = Bare.Addon.load(resolved, { referrer })

    return addon._exports
  }

  require.addon.host = Bare.Addon.host

  require.addon.resolve = function resolve(
    specifier = '.',
    parentURL = referrer._url
  ) {
    return urlToPath(
      Bare.Addon.resolve(specifier, toURL(parentURL, referrer._url), {
        referrer
      })
    )
  }

  require.asset = function asset(specifier, parentURL = referrer._url) {
    return urlToPath(
      self.asset(specifier, toURL(parentURL, referrer._url), { referrer })
    )
  }

  return require
})

if (Bare.simulator) Module._conditions.push('simulator')

Module._extensions['.js'] = function (module, source, referrer) {
  const self = Module

  const protocol = module._protocol
  const resolutions = module._resolutions

  let pkg

  for (const packageURL of resolve.lookupPackageScope(module._url, {
    resolutions
  })) {
    if (self._cache[packageURL.href]) {
      pkg = self._cache[packageURL.href]
      break
    }

    if (protocol.exists(packageURL, constants.types.JSON)) {
      pkg = self.load(packageURL, { protocol })
      break
    }
  }

  const info = (pkg && pkg._exports) || {}

  const isESM =
    // The default type is ES modules.
    constants.types.MODULE === module._defaultType ||
    // The package is explicitly declared as an ES module.
    (info && info.type === 'module')

  return self._extensions[isESM ? '.mjs' : '.cjs'](module, source, referrer)
}

Module._extensions['.cjs'] = function (module, source, referrer) {
  const protocol = module._protocol

  module._type = constants.types.SCRIPT

  if (protocol.load) {
    module._exports = protocol.load(module._url)
  } else {
    if (source === null) source = protocol.read(module._url)

    if (typeof source !== 'string') source = Buffer.coerce(source).toString()

    module._function = binding.createFunction(
      module._url.href,
      ['require', 'module', 'exports', '__filename', '__dirname'],
      source,
      0
    )
  }
}

Module._extensions['.mjs'] = function (module, source, referrer) {
  const self = Module

  const protocol = module._protocol

  module._type = constants.types.MODULE

  if (protocol.load) {
    module._exports = protocol.load(module._url)
  } else {
    if (source === null) source = protocol.read(module._url)

    if (typeof source !== 'string') source = Buffer.coerce(source).toString()

    module._handle = binding.createModule(
      module._url.href,
      source,
      0,
      self._handle
    )
  }
}

Module._extensions['.json'] = function (module, source, referrer) {
  const protocol = module._protocol

  module._type = constants.types.JSON

  if (protocol.load) {
    module._exports = protocol.load(module._url)
  } else {
    if (source === null) source = protocol.read(module._url)

    if (typeof source !== 'string') source = Buffer.coerce(source).toString()

    module._exports = JSON.parse(source)
  }
}

Module._extensions['.bare'] = function (module, source, referrer) {
  module._type = constants.types.ADDON

  referrer = module

  module._exports = Bare.Addon.load(module._url, { referrer }).exports
}

Module._extensions['.node'] = function (module, source, referrer) {
  module._type = constants.types.ADDON

  referrer = module

  module._exports = Bare.Addon.load(module._url, { referrer }).exports
}

Module._extensions['.bundle'] = function (module, source, referrer) {
  const self = Module

  const protocol = module._protocol

  module._type = constants.types.BUNDLE

  if (source === null) source = protocol.read(module._url)

  if (typeof source === 'string') source = Buffer.from(source)

  referrer = module

  const bundle = Bundle.from(source).mount(module._url.href + '/')

  module._bundle = bundle
  module._imports = bundle.imports
  module._resolutions = bundle.resolutions

  module._protocol = protocol.extend({
    postresolve(context, url) {
      return bundle.exists(url.href) ? url : context.postresolve(url)
    },

    exists(context, url) {
      return bundle.exists(url.href) || context.exists(url)
    },

    read(context, url) {
      return bundle.read(url.href) || context.read(url)
    }
  })

  if (bundle.main) {
    module._exports = self.load(
      new URL(bundle.main),
      bundle.read(bundle.main),
      { referrer }
    )._exports
  }
}

Module._extensions['.bin'] = function (module, source, referrer) {
  const protocol = module._protocol

  module._type = constants.types.BINARY

  if (source === null) source = protocol.read(module._url)

  if (typeof source === 'string') source = Buffer.from(source)

  module._exports = source
}

Module._extensions['.txt'] = function (module, source, referrer) {
  const protocol = module._protocol

  module._type = constants.types.TEXT

  if (source === null) source = protocol.read(module._url)

  if (typeof source !== 'string') source = Buffer.coerce(source).toString()

  module._exports = source
}

Module._protocol = new Protocol({
  postresolve(url) {
    switch (url.protocol) {
      case 'file:':
        return pathToFileURL(binding.realpath(fileURLToPath(url)))
      default:
        return url
    }
  },

  exists(url, type = 0) {
    switch (url.protocol) {
      case 'file:':
        return binding.exists(
          fileURLToPath(url),
          type === constants.types.ASSET
            ? binding.FILE | binding.DIR
            : binding.FILE
        )
      default:
        return false
    }
  },

  read(url) {
    switch (url.protocol) {
      case 'file:':
        return Buffer.from(binding.read(fileURLToPath(url)))
      default:
        throw errors.UNKNOWN_PROTOCOL(`Cannot load module '${url.href}'`)
    }
  }
})

Bare.prependListener('teardown', () => {
  for (const module of Module._modules) {
    module.destroy()
  }

  binding.destroy(Module._handle)
})

function toURL(value, base) {
  if (isURL(value)) return value

  if (startsWithWindowsDriveLetter(value)) {
    return pathToFileURL(value)
  }

  return URL.parse(value, base) || pathToFileURL(value)
}

function urlToPath(url) {
  if (url.protocol === 'file:') return fileURLToPath(url)

  if (isWindows) {
    if (/%2f|%5c/i.test(url.pathname)) {
      throw errors.INVALID_URL_PATH(
        'The URL path must not include encoded \\ or / characters'
      )
    }
  } else {
    if (/%2f/i.test(url.pathname)) {
      throw errors.INVALID_URL_PATH(
        'The URL path must not include encoded / characters'
      )
    }
  }

  return decodeURIComponent(url.pathname)
}

function urlToDirname(url) {
  if (url.protocol === 'file:') return path.dirname(fileURLToPath(url))

  if (isWindows) {
    if (/%2f|%5c/i.test(url.pathname)) {
      throw errors.INVALID_URL_PATH(
        'The URL path must not include encoded \\ or / characters'
      )
    }
  } else {
    if (/%2f/i.test(url.pathname)) {
      throw errors.INVALID_URL_PATH(
        'The URL path must not include encoded / characters'
      )
    }
  }

  return decodeURIComponent(new URL('.', url).pathname).replace(/\/$/, '')
}
