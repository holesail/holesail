const safetyCatch = require('./')

try {
  foo.bar()
} catch (err) {
  safetyCatch(err)
}
