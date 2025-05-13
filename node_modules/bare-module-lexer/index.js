const binding = require('#binding')

module.exports = exports = function lex(input, encoding, opts = {}) {
  if (typeof encoding === 'object' && encoding !== null) {
    opts = encoding
    encoding = null
  }

  if (typeof input !== 'string' && !ArrayBuffer.isView(input)) {
    throw new TypeError(
      `Input must be a string or buffer. Received type ${typeof input}`
    )
  }

  return binding.lex(
    typeof input === 'string' ? Buffer.from(input, encoding) : input
  )
}

exports.constants = {
  /**
   * CommonJS `require()`.
   */
  REQUIRE: binding.REQUIRE,

  /**
   * ES module `import`.
   */
  IMPORT: binding.IMPORT,

  /**
   * ES module `import()` if `IMPORT` is set.
   */
  DYNAMIC: binding.DYNAMIC,

  /**
   * CommonJS `require.addon()` if `REQUIRE` is set, or ES module `import.meta.addon()` if `IMPORT` is set.
   */
  ADDON: binding.ADDON,

  /**
   * CommonJS `require.asset()` if `REQUIRE` is set, or ES module `import.meta.asset()` if `IMPORT` is set.
   */
  ASSET: binding.ASSET,

  /**
   * CommonJS `require.resolve()` or `require.addon.resolve()` if `REQUIRE` and optionally `ADDON` are set, or ES module
   * `import.meta.resolve()` or `import.meta.addon.resolve()` if `IMPORT` and optionally `ADDON` are set.
   */
  RESOLVE: binding.RESOLVE,

  /**
   * Re-export of a CommonJS `require()` if `REQUIRE` is set.
   */
  REEXPORT: binding.REEXPORT
}
