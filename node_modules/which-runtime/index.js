const { runtime, platform, arch } = typeof Bare !== 'undefined'
  ? { runtime: 'bare', platform: global.Bare.platform, arch: global.Bare.arch }
  : typeof process !== 'undefined'
    ? { runtime: 'node', platform: global.process.platform, arch: global.process.arch }
    : typeof Window !== 'undefined'
      ? { runtime: 'browser', platform: 'unknown', arch: 'unknown' }
      : { runtime: 'unknown', platform: 'unknown', arch: 'unknown' }

exports.runtime = runtime
exports.platform = platform
exports.arch = arch
exports.isBare = runtime === 'bare'
exports.isNode = runtime === 'node'
exports.isBrowser = runtime === 'browser'
exports.isWindows = platform === 'win32'
exports.isLinux = platform === 'linux'
exports.isMac = platform === 'darwin'
exports.isIOS = platform === 'ios' || platform === 'ios-simulator'
exports.isAndroid = platform === 'android'
exports.isElectron = !!(typeof process !== 'undefined' && global.process.versions.electron)
exports.isElectronRenderer = !!(typeof process !== 'undefined' && global.process.versions.electron && global.process.type === 'renderer')
exports.isElectronWorker = !!(typeof process !== 'undefined' && global.process.versions.electron && global.process.type === 'worker')
