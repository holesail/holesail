/*! standard-engine. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */

const fs = require('fs')
const path = require('path')

const pkgConf = require('pkg-conf')

const {
  ensureArray,
  ensureStringArrayValue,
  stringArrayToObj
} = require('./utils')

/** @typedef {import('../').EslintOptions} EslintOptions */

const DEFAULT_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs'
]

const DEFAULT_IGNORE = [
  '**/*.min.js',
  'coverage/**',
  'node_modules/**',
  'vendor/**'
]

/**
 * @param {EslintOptions} eslintConfig
 * @param {string|string[]} [extensions]
 */
const addExtensions = (eslintConfig, extensions) => {
  if (!extensions) return
  eslintConfig.extensions = (eslintConfig.extensions || []).concat(extensions)
}

/**
 * @param {EslintOptions} eslintConfig
 * @param {string|string[]} [ignore]
 */
const addIgnore = (eslintConfig, ignore) => {
  if (!ignore) return

  if (!eslintConfig.baseConfig) eslintConfig.baseConfig = {}

  eslintConfig.baseConfig.ignorePatterns = [
    ...ensureArray(eslintConfig.baseConfig.ignorePatterns || []),
    ...ensureArray(ignore)
  ]
}

/**
 * @param {EslintOptions} eslintConfig
 * @param {string|string[]} [globals]
 */
const addGlobals = (eslintConfig, globals) => {
  if (!globals) return

  if (!eslintConfig.baseConfig) eslintConfig.baseConfig = {}

  eslintConfig.baseConfig.globals = stringArrayToObj(globals, eslintConfig.baseConfig.globals)
}

/**
 * @param {EslintOptions} eslintConfig
 * @param {string|string[]} [plugins]
 */
const addPlugins = (eslintConfig, plugins) => {
  if (!plugins) return

  if (!eslintConfig.baseConfig) eslintConfig.baseConfig = {}

  eslintConfig.baseConfig.plugins = [
    ...ensureArray(eslintConfig.baseConfig.plugins || []),
    ...ensureArray(plugins)
  ]
}

/**
 * @param {EslintOptions} eslintConfig
 * @param {string|string[]|{[key: string]: string}} [envs]
 */
const addEnvs = (eslintConfig, envs) => {
  if (!envs) return

  /** @type {string[]} */
  let values

  if (!Array.isArray(envs) && typeof envs !== 'string') {
    values = []
    // envs can be an object in `package.json`
    for (const key in envs) {
      const value = envs[key]
      if (value) values.push(value)
    }
  } else {
    values = ensureArray(envs)
  }

  if (!eslintConfig.baseConfig) eslintConfig.baseConfig = {}

  eslintConfig.baseConfig.env = stringArrayToObj(values, eslintConfig.baseConfig.env)
}

/**
 * @param {EslintOptions} eslintConfig
 * @param {string} [parser]
 */
const setParser = (eslintConfig, parser) => {
  if (!parser) return

  if (!eslintConfig.baseConfig) eslintConfig.baseConfig = {}

  eslintConfig.baseConfig.parser = parser
}

/**
 * @typedef ResolveOptions
 * @property {string} cmd
 * @property {string} cwd
 * @property {boolean} [fix]                automatically fix problems
 * @property {string[]|string} [ignore]
 * @property {string[]|string} [extensions]
 * @property {string[]|string} [globals]    custom global variables to declare
 * @property {string[]|string} [global]
 * @property {string[]|string} [plugins]    custom eslint plugins
 * @property {string[]|string} [plugin]
 * @property {string[]|string} [envs]       custom eslint environment
 * @property {string[]|string} [env]
 * @property {string} [parser]              custom js parser (e.g. babel-eslint)
 * @property {boolean} [useGitIgnore]       use .gitignore? (default: true)
 * @property {boolean} [usePackageJson]     use options from nearest package.json? (default: true)
 * @property {boolean} [noDefaultIgnore]
 * @property {boolean} [noDefaultExtensions]
 */

/**
 * @callback CustomEslintConfigResolver
 * @param {Readonly<EslintOptions>} eslintConfig
 * @param {Readonly<ResolveOptions>} opts
 * @param {import('pkg-conf').Config} packageOpts
 * @param {string} rootDir
 * @returns {EslintOptions}
 */

/**
 * @param {Readonly<ResolveOptions>} rawOpts
 * @param {Readonly<EslintOptions>} baseEslintConfig
 * @param {CustomEslintConfigResolver} [customEslintConfigResolver]
 * @returns {EslintOptions}
 */
const resolveEslintConfig = function (rawOpts, baseEslintConfig, customEslintConfigResolver) {
  const opts = {
    usePackageJson: true,
    useGitIgnore: true,
    gitIgnoreFile: ['.gitignore', '.git/info/exclude'],
    ...rawOpts
  }

  const eslintConfig = {
    ...baseEslintConfig,
    cwd: opts.cwd,
    fix: !!opts.fix
  }

  /** @type {import('pkg-conf').Config} */
  let packageOpts = {}
  let rootPath = ''

  if (opts.usePackageJson || opts.useGitIgnore) {
    packageOpts = pkgConf.sync(opts.cmd, { cwd: opts.cwd })
    const packageJsonPath = pkgConf.filepath(packageOpts)
    if (packageJsonPath) rootPath = path.dirname(packageJsonPath)
  }

  if (!opts.usePackageJson) packageOpts = {}

  addIgnore(eslintConfig, ensureStringArrayValue(packageOpts.ignore))
  addIgnore(eslintConfig, opts.ignore)

  if (!packageOpts.noDefaultIgnore && !opts.noDefaultIgnore) {
    addIgnore(eslintConfig, DEFAULT_IGNORE)
  }

  addExtensions(eslintConfig, ensureStringArrayValue(packageOpts.extensions))
  addExtensions(eslintConfig, opts.extensions)

  if (!packageOpts.noDefaultExtensions && !opts.noDefaultExtensions) {
    addExtensions(eslintConfig, DEFAULT_EXTENSIONS)
  }

  if (opts.useGitIgnore && rootPath !== '') {
    (Array.isArray(opts.gitIgnoreFile) ? opts.gitIgnoreFile : [opts.gitIgnoreFile])
      .map(gitIgnoreFile => {
        try {
          return fs.readFileSync(path.join(rootPath, gitIgnoreFile), 'utf8')
        } catch (err) {
          return null
        }
      })
      .filter(Boolean)
      .forEach(gitignore => {
        gitignore && addIgnore(eslintConfig, gitignore.split(/\r?\n/))
      })
  }

  addGlobals(eslintConfig, ensureStringArrayValue(packageOpts.globals || packageOpts.global))
  addGlobals(eslintConfig, opts.globals || opts.global)

  addPlugins(eslintConfig, ensureStringArrayValue(packageOpts.plugins || packageOpts.plugin))
  addPlugins(eslintConfig, opts.plugins || opts.plugin)

  addEnvs(eslintConfig, ensureStringArrayValue(packageOpts.envs || packageOpts.env))
  addEnvs(eslintConfig, opts.envs || opts.env)

  setParser(eslintConfig, typeof packageOpts.parser === 'string' ? packageOpts.parser : opts.parser)

  if (customEslintConfigResolver) {
    /**
     * @type {string}
     */
    let rootDir
    if (opts.usePackageJson) {
      const filePath = pkgConf.filepath(packageOpts)
      rootDir = filePath ? path.dirname(filePath) : opts.cwd
    } else {
      rootDir = opts.cwd
    }
    return customEslintConfigResolver(eslintConfig, opts, packageOpts, rootDir)
  } else {
    return eslintConfig
  }
}

module.exports = { resolveEslintConfig }
