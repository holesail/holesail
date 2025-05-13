/*! standard-engine. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */

/**
 * @template T
 * @param {T[]|T} value
 * @returns {T[]}
 */
const ensureArray = (value) => Array.isArray(value) ? [...value] : [value]

/**
 * @param {unknown} value
 * @returns {string[]}
 */
const ensureStringArrayValue = (value) => {
  if (!Array.isArray(value)) return []

  /** @type {string[]} */
  const result = []

  for (const item of value) {
    if (typeof item === 'string') result.push(item)
  }

  return result
}

/**
 * @template T
 * @param {string|string[]} values
 * @param {{ [key: string]: T }} base
 * @returns {{ [key: string]: T|true }}
 */
const stringArrayToObj = (values, base = {}) => {
  /** @type {{ [key: string]: T|true }} */
  const result = { ...base }

  for (const value of ensureArray(values)) {
    result[value] = true
  }

  return result
}

module.exports = {
  ensureArray,
  ensureStringArrayValue,
  stringArrayToObj
}
