/* eslint-disable no-var, no-console, promise/prefer-await-to-then, unicorn/no-process-exit */

'use strict';

// This file purely exists because "import" is a reserved word in old node.js and
// thus can't be included directly in the index.js file without error

/**
 * @param {string} filePath
 */
var bridge = function (filePath) {
  // eslint-disable-next-line n/no-unsupported-features/es-syntax
  import(filePath).catch(err => {
    console.error('unexpected error:', err);
    process.exit(1);
  });
};

module.exports = bridge;
