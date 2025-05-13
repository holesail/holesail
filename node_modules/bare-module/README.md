# bare-module

Module support for JavaScript.

```
npm i bare-module
```

## Usage

```js
const Module = require('bare-module')
```

## Packages

A package is a directory with a `package.json` file.

### Fields

#### `"name"`

```json
{
  "name": "my-package"
}
```

The name of the package. This is used for [addon resolution](https://github.com/holepunchto/bare-addon-resolve#algorithm), [self-referencing](#self-referencing), and importing packages by name.

#### `"version"`

```json
{
  "version": "1.2.3"
}
```

The current version of the package. This is used for [addon resolution](https://github.com/holepunchto/bare-addon-resolve#algorithm).

#### `"type"`

```json
{
  "type": "module"
}
```

The module format used for `.js` files. If not defined, `.js` files are interpreted as CommonJS. If set to `"module"`, `.js` files are instead interpreted as ES modules.

#### `"exports"`

```json
{
  "exports": {
    ".": "./index.js"
  }
}
```

The entry points of the package. If defined, only the modules explicitly exported by the package may be imported when importing the package by name.

##### Subpath exports

A package may define more than one entry point by declaring several subpaths with the main export being `"."`:

```json
{
  "exports": {
    ".": "./index.js",
    "./submodule": "./lib/submodule.js"
  }
}
```

When importing the package by name, `require('my-package')` will resolve to `<modules>/my-package/index.js` whereas `require('my-package/submodule')` will resolve to `<modules>/my-package/lib/submodule.js`.

##### Conditional exports

Conditional exports allow packages to provide different exports for different conditions, such as the loading method the importing module uses (e.g. `require()` vs `import`):

```json
{
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.cjs"
    }
  }
}
```

When importing the package by name, `require('my-package')` will resolve to `<modules>/my-package/index.cjs` whereas `import 'my-package'` will resolve to `<modules>/my-package/index.mjs`.

Similarly, conditional exports can be used to provide different entry points for different runtimes:

```json
{
  "exports": {
    ".": {
      "bare": "./bare.js",
      "node": "./node.js"
    }
  }
}
```

To provide a fallback for when no other conditions match, the `"default"` condition can be declared:

```json
{
  "exports": {
    ".": {
      "bare": "./bare.js",
      "node": "./node.js",
      "default": "./fallback.js"
    }
  }
}
```

The following conditions are supported, listed in order from most specific to least specific as conditions should be defined:

| Condition      | Description                                                                                                                         |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `"import"`     | Matches when the package is loaded via `import` or `import()`.                                                                      |
| `"require"`    | Matches when the package is loaded via `require()`.                                                                                 |
| `"asset"`      | Matches when the package is loaded via `require.asset()`.                                                                           |
| `"addon"`      | Matches when the package is loaded via `require.addon()`.                                                                           |
| `"bare"`       | Matches for any [Bare](https://github.com/holepunchto/bare) environment.                                                            |
| `"node"`       | Matches for any Node.js environment.                                                                                                |
| `"<platform>"` | Matches when equal to `Bare.platform`. See [`Bare.platform`](https://github.com/holepunchto/bare#bareplatform) for possible values. |
| `"<arch>"`     | Matches when equal to `Bare.arch`. See [`Bare.arch`](https://github.com/holepunchto/bare#barearch) for possible values.             |
| `"simulator"`  | Matches when Bare was compiled for a simulator, i.e. when `Bare.simulator` is `true`.                                               |
| `"default"`    | The fallback that always matches. This condition should always be last.                                                             |

Export conditions are evaluated in the order they are defined in the `"exports"` field. This means that less specific conditionals defined first will override more specific conditions define later. For example, the following will always call `./fallback.js` because `"default"` always matches and is defined first.

```json
{
  "exports": {
    ".": {
      "default": "./fallback.js",
      "bare": "./bare.js"
    }
  }
}
```

This is why the general rule is that conditions should be from most specific to least specific when defined.

##### Self-referencing

Within a package, exports defined in the `"exports"` field can be referenced by importing the package by name. For example, given the following `package.json`...

```json
{
  "name": "my-package",
  "exports": {
    ".": "./index.js",
    "./submodule": "./lib/submodule.js"
  }
}
```

...any module within `my-package` may reference these entry points using either `require('my-package')` or `require('my-package/submodule')`.

##### Exports sugar

If a package defines only a single export, `"."`, it may leave out the subpath entirely:

```json
{
  "exports": "./index.js"
}
```

#### `"imports"`

A private mapping for import specifiers within the package itself. Similar to `"exports"`, the `"imports"` field can be used to conditional import other packages within the package. But unlike `"exports"`, `"imports"` permits mapping to external packages.

The rules are otherwise analogous to the [`"exports"`](#conditional-exports) field.

##### Subpath imports

Just like exports, subpaths can be used when importing a module internally.

```json
{
  "imports": {
    ".": "./index.js",
    "./submodule": "./lib/submodule.js"
  }
}
```

##### Conditional imports

Adding conditional imports allows importing different packages based on the configured conditions. As an example:

```json
{
  "imports": {
    "bar": {
      "require": "./baz.cjs",
      "import": "./baz.mjs"
    }
  }
}
```

When importing the package `bar` as `require('bar')` will resolve to `./baz.cjs`, but when importing with `import('bar')` will resolve to `./baz.mjs`.

To provide a fallback for when no other conditions are met, the `"default"` condition can be configured like so:

```json
{
  "imports": {
    "bar": {
      "require": "./baz.cjs",
      "asset": "./baz.txt",
      "default": "./baz.mjs"
    }
  }
}
```

The following conditions are supported, listed in order from most specific to least specific as conditions should be defined:

| Condition      | Description                                                                                                                         |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `"import"`     | Matches when the package is loaded via `import` or `import()`.                                                                      |
| `"require"`    | Matches when the package is loaded via `require()`.                                                                                 |
| `"asset"`      | Matches when the package is loaded via `require.asset()`.                                                                           |
| `"addon"`      | Matches when the package is loaded via `require.addon()`.                                                                           |
| `"bare"`       | Matches for any [Bare](https://github.com/holepunchto/bare) environment.                                                            |
| `"node"`       | Matches for any Node.js environment.                                                                                                |
| `"<platform>"` | Matches when equal to `Bare.platform`. See [`Bare.platform`](https://github.com/holepunchto/bare#bareplatform) for possible values. |
| `"<arch>"`     | Matches when equal to `Bare.arch`. See [`Bare.arch`](https://github.com/holepunchto/bare#barearch) for possible values.             |
| `"simulator"`  | Matches when Bare was compiled for a simulator, ie when `Bare.simulator` is `true`.                                                 |
| `"default"`    | The fallback that always matches. This condition should always be last.                                                             |

The general rule is that conditions should be from most specific to least specific when defined.

##### `#` Prefix

All import maps are private to the package and allow mapping to external packages. Entries in `"imports"` may start with `#` to disambiguate from external packages, but it is not required unlike in Node.js.

#### `"engines"`

```json
{
  "engines": {
    "bare": ">=1.0.5"
  }
}
```

The `"engines"` field defines the engine requirements of the package. During module resolution, the versions declared by `Bare.versions` will be tested against the requirements declared by the package and resolution fail if they're not satisfied.

## API

#### `Module.constants.states`

The flags for the current state of a module.

| Constant      | Description                                  |
| :------------ | :------------------------------------------- |
| `EVALUATED`   | The module has been evaluated.               |
| `SYNTHESIZED` | The module named exports have been detected. |
| `DESTROYED`   | The module has been unloaded.                |

#### `Module.constants.types`

| Constant | Description                                                                  |
| :------- | :--------------------------------------------------------------------------- |
| `SCRIPT` | The module is a CommonJS module.                                             |
| `MODULE` | The module is a ECMAScript module.                                           |
| `JSON`   | The module is a JSON file.                                                   |
| `BUNDLE` | The module is a [`bare-bundle`](https://github.com/holepunchto/bare-bundle). |
| `ADDON`  | The module is a native addon.                                                |
| `BINARY` | The module is a binary file.                                                 |
| `TEXT`   | The module is a text file.                                                   |

#### `Module.protocol`

The default `ModuleProtocol` class for resolving, reading and loading modules. See [Protocols](#protocols) for usage.

#### `Module.cache`

The global cache of loaded modules.

#### `const url = Module.resolve(specifier, parentURL[, options])`

Resolve the module `specifier` relative to the `parentURL`. `specifier` is a string and `parentURL` is a WHATWG `URL`.

Options include:

```js
options = {
  // Whether the module is called via `import` or `import()`.
  isImport: false,
  // The referring module.
  referrer: null,
  // The type of the module. See Module.constants.types for possible values. The
  // default is the equivalent constant of the `attributes`'s `type` property.
  type,
  // A list of file extensions to look for. The default is based on the `type`
  // option.
  extensions: [],
  // The ModuleProtocol to resolve the specifier. Defaults to referrer's
  // protocol if defined, otherwise defaults to Module.protocol
  protocol,
  // A default "imports" map to apply to all specifiers. Follows the same
  // syntax and rules as the "imports" property defined in `package.json`.
  imports,
  // A map of preresolved imports with keys being serialized parent URLs and
  // values being "imports" maps.
  resolutions,
  // A map of builtin module specifiers to loaded modules. If matched by the
  // default resolver, the protocol of the resolved URL will be `builtin:`.
  builtins,
  // The supported import conditions. "default" is always recognized.
  conditions: [],
  // The import attributes, e.g. the `{ type: "json" }` in:
  // `import foo from 'foo' with { type: "json" }`
  // or in:
  // `require('foo', { with: { type: "json" } })`
  attributes
}
```

#### `const module = Module.load(url[, source][, options])`

Load a module with the provided `url`. `url` is a WHATWG `URL`. If provided, the `source` will be passed to the matching `extension` for the `url`.

Options include:

```js
options = {
  // Whether the module is called via `import` or `import()`.
  isImport: false,
  // Whether the module is called via `import()`.
  isDynamicImport: false,
  // The referring module.
  referrer: null,
  // The type of the module. See Module.constants.types for possible values. The
  // default is the equivalent constant of the `attributes`'s `type` property.
  type,
  // The assumed type of a module without a type using an ambiguous extension
  // such as `.js`. See Module.constants.types. Inherited from `referrer` if it
  // is defined.
  defaultType: Module.constants.types.SCRIPT,
  // Cache to use to load the Module. Defaults to `Module.cache`.
  cache,
  // The module representing the entry script where the program was launched.
  main,
  // The ModuleProtocol to use resolve the specifier. Defaults to referrer's
  // `protocol` if defined, otherwise defaults to `Module.protocol`.
  protocol,
  // A default "imports" map to apply to all specifiers. Follows the same
  // syntax and rules as the "imports" property defined in `package.json`.
  imports,
  // A map of preresolved imports with keys being serialized parent URLs and
  // values being "imports" maps.
  resolutions,
  // A map of builtin module specifiers to loaded modules. If the `url`'s
  // protocol is `builtin:`, the module's exports will be set to the matching
  // value in the map for `url.pathname`.
  builtins,
  // The supported import conditions. "default" is always recognized.
  conditions,
  // The import attributes, e.g. the `{ type: "json" }` in:
  // `import foo from 'foo' with { type: "json" }`
  // or in:
  // `require('foo', { with: { type: "json" } })`
  attributes
}
```

#### `const url = Module.asset(specifier, parentURL[, options])`

Get the asset URL by resolving `specifier` relative to `parentURL`. `specifier` is a string and `parentURL` is a WHATWG `URL`.

Options include:

```js
options = {
  // The referring module.
  referrer: null,
  // The ModuleProtocol to use resolve the specifier. Defaults to referrer's
  // protocol if defined, otherwise defaults to Module.protocol
  protocol,
  // A default "imports" map to apply to all specifiers. Follows the same
  // syntax and rules as the "imports" property defined in `package.json`.
  imports,
  // A map of preresolved imports with keys being serialized parent URLs and
  // values being "imports" maps.
  resolutions,
  // The supported import conditions. "default" is always recognized.
  conditions
}
```

#### `module.url`

The WHATWG `URL` instance for the module.

#### `module.filename`

The pathname of the `module.url`.

#### `module.dirname`

The directory name of the module.

#### `module.type`

The type of the module. See [`Module.constants.types`](#module.constants.types) for possible values.

#### `module.defaultType`

The assumed type of a module without a `type` using an ambiguous extension, such as `.js`. See [`Module.constants.types`](#module.constants.types) for possible values.

#### `module.cache`

A cache of loaded modules for this module. Defaults to `Module.cache`.

#### `module.main`

The module representing the entry script where the program was launched.

#### `module.exports`

The exports from the module.

#### `module.imports`

The import map when the module was loaded.

#### `module.resolutions`

A map of preresolved imports with keys being serialized parent URLs and values being `"imports"` maps.

#### `module.builtins`

A map of builtin module specifiers mapped to the loaded module.

#### `module.conditions`

An array of conditions used to resolve dependencies while loading the module. See [Conditional Exports](#conditional-exports) for possible values.

#### `module.protocol`

The `ModuleProtocol` class used for resolving, reading and loading modules. See [Protocols](#protocols).

#### `module.destroy()`

Unloads the module.

### CommonJS modules

#### `require(specifier[, options])`

Used to import JavaScript or JSON modules and local files. Relative paths such as `./`, `./foo`, `./bar/baz`, and `../foo` will be resolved against the directory named by `__dirname`. POSIX style paths are resolved in an OS independent fashion, meaning that the examples above will work on Windows in the same way they would on POSIX systems.

Returns the exported module contents.

Options include:

```js
options = {
  // The import attributes which instruct how the file or module should be loaded.
  // Possible values for `type` are `script`, `module`, `json`, `bundle`,
  // `addon`, `binary` and `text`.
  with: { type: 'json' }
}
```

#### `require.main`

The module representing the entry script where the program was launched. The same value as [`module.main`](#modulemain) for the current module.

#### `require.cache`

A cache of loaded modules for this module. The same value as `module.cache` for the current module.

#### `const path = require.resolve(specifier[, parentURL])`

Use the internal machinery of `require()` to resolve the `specifier` string relative to the URL `parentURL` and return the path string.

#### `require.addon([specifier][, parentURL])`

Also used to import modules but specifically loads only addon modules. `specifier` is resolved relative to `parentURL` using the [addon resolution](https://github.com/holepunchto/bare-addon-resolve#algorithm) algorithm.

Returns the exported module contents.

A common pattern for writing an addon module is to use `require.addon()` as the JavaScript module exports:

```js
module.exports = require.addon()
```

See [`bare-addon`](https://github.com/holepunchto/bare-addon) for a template of building native addon modules.

#### `require.addon.host`

Returns the string representation of the platform and architecture used when resolving addons with the pattern `<platform>-<arch>[-simulator]`. Returns the same value as `Bare.Addon.host`.

#### `const path = require.addon.resolve([specifier][, parentURL])`

Resolve the `specifier` string relative to the URL `parentURL` as an addon and returns the path string. The `specifier` is resolved using the [addon resolution algorithm](https://github.com/holepunchto/bare-addon-resolve#algorithm).

#### `const path = require.asset(specifier[, parentURL])`

Resolve the `specifier` relative to the `parentURL` and return the path of the asset as a string.

Can be used to load assets, for example the following loads `./foo.txt` from the local files:

```js
const fs = require('bare-fs')
const contents = fs.readFileSync(require.asset('./foo.txt'))
```

### ECMAScript modules

#### `import defaultExport, * as name, { export1, export2 as alias2, ... } from 'specifier' with { type: 'json' }`

The static `import` declaration is used to import read-only live bindings that are exported by another module. The imported bindings are called _live_ bindings because they are updated by the module that exported the binding, but cannot be re-assigned by the importing module. In brief, you can import what is exported from another module.

For more information on `import` syntax, see [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import).

#### `import.meta.url`

The string representation of the URL for the current module.

#### `import.meta.main`

A boolean representing whether the current module is the entry script where the program was launched.

#### `import.meta.cache`

A cache of loaded modules for this module. The same value as `module.cache` for the current module.

#### `const href = import.meta.resolve(specifier[, parentURL])`

A module-relative resolution function which returns the URL string for the module. The `specifier` is a string which is resolved relative to the `parentURL` which is a WHATWG URL.

#### `import.meta.addon([specifier][, parentURL])`

Also used to import modules but specifically loads only addon modules. `specifier` is resolved relative to `parentURL` using the [addon resolution](https://github.com/holepunchto/bare-addon-resolve#algorithm) algorithm.

Returns the exported module contents.

#### `import.meta.addon.host`

Returns the string representation of the platform and architecture used when resolving addons with the pattern `<platform>-<arch>[-simulator]`. Returns the same value as `Bare.Addon.host`.

#### `const href = import.meta.addon.resolve([specifier][, parentURL])`

Resolve the `specifier` string relative to the URL `parentURL` as an addon and returns the URL string. The `specifier` is resolved using the [addon resolution algorithm](https://github.com/holepunchto/bare-addon-resolve#algorithm).

#### `const href = import.meta.asset(specifier[, parentURL])`

Resolve the `specifier` relative to the `parentURL` and return the URL of the asset as a string.

### Custom `require()`

Creating a custom require allows one to create a preconfigured `require()`. This can be useful in scenarios such as a Read-Evaluate-Print-Loop (REPL) where the parent URL is set to a directory so requiring relative paths to work correctly.

#### `const require = Module.createRequire(parentURL[, options])`

Options include:

```js
options = {
  // The module to become the `referrer` for the returned `require()`. Defaults
  // to creating a new module instance from the `parentURL` with the same
  // options.
  module: null,
  // The referring module.
  referrer: null,
  // The type of the module. See Module.constants.types for possible values.
  type: Module.constants.types.SCRIPT,
  // The assumed type of a module without a type using an ambiguous extension
  // such as `.js`. See Module.constants.types. Inherited from `referrer` if it
  // is defined, otherwise defaults to SCRIPT.
  defaultType: Module.constants.types.SCRIPT,
  // A cache of loaded modules. Inherited from `referrer` if it is defined,
  // otherwise defaults to `Module.cache`
  cache,
  // The module representing the entry script where the program was launched.
  main,
  // The ModuleProtocol to use resolve the specifier and/or the module. Defaults to
  // referrer's protocol if defined, otherwise defaults to Module.protocol
  protocol,
  // A default "imports" map to apply to all specifiers. Follows the same
  // syntax and rules as the "imports" property defined in `package.json`.
  imports,
  // A map of preresolved imports with keys being serialized parent URLs and
  // values being "imports" maps.
  resolutions,
  // A map of builtin module specifiers to loaded modules.
  builtins,
  // The supported import conditions. "default" is always recognized.
  conditions
}
```

### Protocols

Protocols define how to resolve, access and load modules. Custom protocols can be defined to extend or replace how module are resolved and loaded to support things like loading modules via a [`Hyperdrive`](https://github.com/holepunchto/hyperdrive).

#### `const protocol = new Module.Protocol(methods, context = null)`

Methods include:

```js
methods = {
  // function (specifier, parentURL): string
  // A function to preprocess the `specifier` and `parentURL` before the resolve
  // algorithm is called.
  preresolve,
  // function (url): string
  // A function to process the resolved URL. Can be used to convert file paths,
  // etc.
  postresolve,
  // function* (specifier, parentURL, imports): [URL]
  // A generator to resolve the `specifier` to a URL.
  resolve,
  // function (url): boolean
  // A function that returns whether the URL exists as a boolean.
  exists,
  // function (url): string | Buffer
  // A function that returns the source code of a URL represented as a string or
  // buffer.
  read,
  // function (url): object
  // A function that returns the evaluated exports for the url. This is
  // only called for Javascript modules (extensions `.js`, `.cjs` & `.mjs`)
  // by default. If defined, this function will skip calling `read()` and
  // evaluating the source method for the default implementations of the
  // Javascript extensions.
  load,
  // function (url): URL
  // A function used to post process URLs for addons before `postresolve()`.
  addon,
  // function (url): URL
  // A function used to post process URLs for assets before `postresolve()`.
  asset
}
```

### Bundles

#### `const bundle = new Module.Bundle()`

See <https://github.com/holepunchto/bare-bundle>.

## License

Apache-2.0
