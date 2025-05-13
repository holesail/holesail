const os = require('bare-os')

module.exports = new Proxy(Object.create(null), {
  ownKeys (target) {
    return os.getEnvKeys()
  },

  get (target, property) {
    if (typeof property !== 'string') return

    return os.getEnv(property)
  },

  has (target, property) {
    if (typeof property !== 'string') return false

    return os.hasEnv(property)
  },

  set (target, property, value) {
    if (typeof property !== 'string') return

    const type = typeof value

    if (type !== 'string' && type !== 'number' && type !== 'boolean') {
      throw new Error('Environment variable must be of type string, number, or boolean')
    }

    value = String(value)

    os.setEnv(property, value)

    return true
  },

  deleteProperty (target, property) {
    if (typeof property !== 'string') return

    os.unsetEnv(property)
  },

  getOwnPropertyDescriptor (target, property) {
    return {
      value: this.get(target, property),
      enumerable: true,
      configurable: true,
      writable: true
    }
  }
})
