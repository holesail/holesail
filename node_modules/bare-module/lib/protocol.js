module.exports = class ModuleProtocol {
  constructor(methods = {}, context = null) {
    for (const name of [
      'preresolve',
      'postresolve',
      'resolve',
      'exists',
      'read',
      'load',
      'addon',
      'asset'
    ]) {
      const method = methods[name]

      if (typeof method === 'function') {
        this[name] = context ? method.bind(this, context) : method.bind(this)
      } else if (context) {
        const method = context[name]

        if (typeof method === 'function') {
          this[name] = method
        }
      }
    }
  }

  preresolve(specifier, parentURL) {
    return specifier
  }

  postresolve(url) {
    return url
  }

  *resolve(specifier, parentURL, imports) {}

  exists(url, type) {
    return false
  }

  read(url) {
    return null
  }

  addon(url) {
    return url
  }

  asset(url) {
    return url
  }

  extend(methods) {
    return new ModuleProtocol(methods, this)
  }
}
