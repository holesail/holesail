/* eslint-disable no-var, no-console, unicorn/no-process-exit, unicorn/prefer-number-properties */

// eslint-disable-next-line unicorn/prefer-node-protocol
var path = require('path');

var LOWEST_SUPPORTED_MAJOR = 12;
var LOWEST_SUPPORTED_MINOR = 17;

/**
 * @param {string} filePath
 * @param {number} minMajor
 * @param {number} [minMinor]
 * @returns {void}
 */
var versionGuard = function (filePath, minMajor, minMinor) {
  if (!filePath || typeof filePath !== 'string') throw new TypeError('Expected filePath to be a non-empty string');
  if (typeof minMajor !== 'number') throw new TypeError('Expected minMajor to be a number');
  if (minMinor !== undefined && typeof minMinor !== 'number') throw new TypeError('Expected minMinor to be undefined or a number');

  var mainFile = (require.main || {}).filename || '';

  if (mainFile === '') {
    throw new Error('Missing mainFile, indication this is run directly, it should not be, failing');
  }

  var mainPath = path.dirname(mainFile);
  var pkgPath = path.resolve(
    mainPath,
    (mainPath.slice(-4) === '/bin' || mainPath.slice(-4) === '\\bin')
      ? '../package.json'
      : './package.json'
  );
  /** @type {{ [key: string]: any } | undefined} */
  var pkgJson;

  try {
    // eslint-disable-next-line security/detect-non-literal-require
    pkgJson = require(pkgPath);
  } catch (err) {
    throw new Error(
      'Could not find a package.json at expected path "' + pkgPath + '", hence failing. Got error: ' +
      // @ts-ignore
      (err || {}).message
    );
  }

  /** @type {string} */
  var packageName = (pkgJson || {})['name'] || '';
  /** @type {string} */
  var nodeEngine = (((pkgJson || {})['engines'] || {})['node']);

  var regexpString = '\\b' + minMajor + (minMinor === undefined ? '' : '\\.' + minMinor) + '\\b';
  // eslint-disable-next-line security/detect-non-literal-regexp
  var regexpInstance = new RegExp(regexpString);

  if (!nodeEngine || !regexpInstance.test(nodeEngine)) {
    console.error(packageName + ': Warning to maintainer: Could not find expected minimum versions ("' + minMajor + (minMinor === undefined ? '' : '.' + minMinor) + '") in package.json engine definition for "node". Found:', nodeEngine);
    process.exit(1);
  }

  if (minMajor < LOWEST_SUPPORTED_MAJOR || (minMajor === LOWEST_SUPPORTED_MAJOR && (minMinor || 0) < LOWEST_SUPPORTED_MINOR)) {
    var minimumTarget = LOWEST_SUPPORTED_MAJOR + '.' + LOWEST_SUPPORTED_MINOR + '.0';

    console.error(packageName + ': Warning to maintainer: Minimum usable version guard is ' + minimumTarget + ' but got "' + minMajor + (minMinor === undefined ? '' : '.' + minMinor) + '". As we use import() we ensure that we will fail silently on everything below ' + minimumTarget);

    minMajor = LOWEST_SUPPORTED_MAJOR;
    minMinor = LOWEST_SUPPORTED_MINOR;
  }

  var match = process.version.match(/v(\d+)\.(\d+)/) || [];
  var currentMajor = parseInt(match[1] || '', 10);
  var currentMinor = parseInt(match[2] || '', 10);

  if (
    currentMajor > minMajor ||
    (currentMajor === minMajor && currentMinor >= (minMinor || 0))
  ) {
    var importPath = path.resolve(mainPath, filePath);
    // Windows paths needs to be formatted like file:///c:/
    if (importPath[0] !== '/') {
      importPath = 'file:///' + importPath.split('\\').join('/');
    }
    // We now know its safe to proceed and load the file with the import() method
    require('./lib/bridge')(importPath);
  } else {
    console.error(packageName + ': Node ' + minMajor + '.' + minMinor + '.0 or greater is required, failing silently.');
    process.exit(0);
  }
};

module.exports = versionGuard;
