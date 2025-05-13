#!/usr/bin/env node

const minimist = require('minimist')
const getStdin = require('get-stdin')

/**
 * @typedef StandardCliOptions
 * @property {import('../').StandardEngine} [standardEngine]
 * @property {string} [cmd]
 * @property {string} [tagline]
 * @property {string} [homepage]
 * @property {string} [bugs]
 */

/**
 * @param {Omit<import('../').StandardEngineOptions, 'cmd'> & StandardCliOptions} rawOpts
 * @returns {void}
 */
function cli (rawOpts) {
  const opts = {
    cmd: 'standard-engine',
    tagline: 'JavaScript Custom Style',
    version: '0.0.0',
    ...rawOpts
  }

  const standard = rawOpts.standardEngine || new (require('../').StandardEngine)(opts)

  const argv = minimist(process.argv.slice(2), {
    alias: {
      global: 'globals',
      plugin: 'plugins',
      env: 'envs',
      help: 'h'
    },
    boolean: [
      'fix',
      'help',
      'stdin',
      'version'
    ],
    string: [
      'ext',
      'ignore',
      'global',
      'plugin',
      'parser',
      'env'
    ]
  })

  // Unix convention: Command line argument `-` is a shorthand for `--stdin`
  if (argv._[0] === '-') {
    argv.stdin = true
    argv._.shift()
  }

  if (argv.help) {
    if (opts.tagline) console.log('%s - %s (%s)', opts.cmd, opts.tagline, opts.homepage)
    console.log(`
Usage:
    ${opts.cmd} <flags> [FILES...]

    If FILES is omitted, all JavaScript source files (*.js, *.jsx, *.mjs, *.cjs)
    in the current working directory are checked, recursively.

    Certain paths (node_modules/, coverage/, vendor/, *.min.js, and
    files/folders that begin with '.' like .git/) are automatically ignored.

    Paths in a project's root .gitignore file are also automatically ignored.

Flags:
        --fix       Automatically fix problems
        --version   Show current version
    -h, --help      Show usage information

Flags (advanced):
        --stdin     Read file text from stdin
        --ext       Specify JavaScript file extensions
        --ignore    Specify files to ignore
        --global    Declare global variable
        --plugin    Use custom eslint plugin
        --env       Use custom eslint environment
        --parser    Use custom js parser (e.g. babel-eslint)
    `)
    process.exitCode = 0
    return
  }

  if (argv.version) {
    console.log(opts.version)
    process.exitCode = 0
    return
  }

  const lintOpts = {
    fix: argv.fix,
    extensions: argv.ext,
    ignore: argv.ignore,
    globals: argv.global,
    plugins: argv.plugin,
    envs: argv.env,
    parser: argv.parser
  }

  const outputFixed = argv.stdin && argv.fix

  /**
   * Print lint errors to stdout -- this is expected output from `standard-engine`.
   * Note: When fixing code from stdin (`standard --stdin --fix`), the transformed
   * code is printed to stdout, so print lint errors to stderr in this case.
   * @type {typeof console.log}
   */
  const log = (...args) => {
    if (outputFixed) {
      args[0] = opts.cmd + ': ' + args[0]
      console.error.apply(console, args)
    } else {
      console.log.apply(console, args)
    }
  }

  Promise.resolve(argv.stdin ? getStdin() : '').then(async stdinText => {
    /** @type {import('eslint').ESLint.LintResult[]} */
    let results

    try {
      results = argv.stdin
        ? await standard.lintText(stdinText, lintOpts)
        : await standard.lintFiles(argv._, lintOpts)
    } catch (err) {
      console.error(opts.cmd + ': Unexpected linter output:\n')
      if (err instanceof Error) {
        console.error(err.stack || err.message)
      } else {
        console.error(err)
      }
      console.error(
        '\nIf you think this is a bug in `%s`, open an issue: %s',
        opts.cmd,
        opts.bugs
      )
      process.exitCode = 1
      return
    }

    if (!results) throw new Error('expected a results')

    if (outputFixed) {
      if (results[0] && results[0].output) {
        // Code contained fixable errors, so print the fixed code
        process.stdout.write(results[0].output)
      } else {
        // Code did not contain fixable errors, so print original code
        process.stdout.write(stdinText)
      }
    }

    const hasErrors = results.some(item => item.errorCount !== 0)
    const hasWarnings = results.some(item => item.warningCount !== 0)

    if (!hasErrors && !hasWarnings) {
      process.exitCode = 0
      return
    }

    console.error('%s: %s (%s)', opts.cmd, opts.tagline, opts.homepage)

    if (hasWarnings) {
      const homepage = opts.homepage != null ? ` (${opts.homepage})` : ''
      console.error(
        '%s: %s',
        opts.cmd,
        `Some warnings are present which will be errors in the next version${homepage}`
      )
    }

    // Are any fixable rules present?
    const hasFixable = results.some(item => item.messages.some(message => !!message.fix))

    if (hasFixable) {
      console.error(
        '%s: %s',
        opts.cmd,
        'Run `' + opts.cmd + ' --fix` to automatically fix some problems.'
      )
    }

    for (const item of results) {
      for (const message of item.messages) {
        log(
          '  %s:%d:%d: %s%s%s',
          item.filePath,
          message.line || 0,
          message.column || 0,
          message.message,
          ' (' + message.ruleId + ')',
          message.severity === 1 ? ' (warning)' : ''
        )
      }
    }

    process.exitCode = hasErrors ? 1 : 0
  })
    .catch(err => process.nextTick(() => { throw err }))
}

module.exports = cli
