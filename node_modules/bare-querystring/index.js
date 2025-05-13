const escape = exports.escape = function escape (str) {
  return encodeURIComponent(str)
}

const unescape = exports.unescape = function unescape (str) {
  return decodeURIComponent(str)
}

exports.parse = function parse (str, sep = '&', eq = '=') {
  const obj = Object.create(null)

  for (const tmp of str.split(sep)) {
    if (tmp === '') continue

    let [key, value] = tmp.split(eq)

    key = unescape(key)
    value = unescape(value || '')

    obj[key] = key in obj
      ? [].concat(obj[key], value)
      : value
  }

  return obj
}

exports.stringify = function stringify (obj, sep = '&', eq = '=') {
  return Object
    .entries(obj)
    .map(([key, value]) =>
      (Array.isArray(value) ? value : [value])
        .map((value) => escape(key) + eq + escape(value))
        .join(sep)
    )
    .join(sep)
}

exports.decode = exports.parse
exports.encode = exports.stringify
