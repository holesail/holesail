# bare-module-lexer

Heuristic lexer for detecting imports and exports in JavaScript modules. It trades off correctness for performance, aiming to reliably support the most common import and export patterns with as little overhead as possible.

## Usage

```js
const lex = require('bare-module-lexer')

lex(`
  const foo = require('./foo.js')
  exports.bar = 42
`)

// {
//   imports: [
//     { specifier: './foo.js', type: REQUIRE, names: [], position: [ 15, 24, 32 ] }
//   ],
//   exports: [
//     { name: 'bar', position: [ 37, 45, 48 ] }
//   ]
// }
```

## API

#### `const { imports, exports } = lex(source[, encoding][, options])`

`imports` is an array of objects with the following shape:

```js
imports = {
  specifier: 'string',
  type: number,
  names: ['string'],
  position: [
    number, // Import start
    number, // Specifier start
    number // Specifier end
  ]
}
```

`exports` is an array of objects with the following shape:

```js
exports = {
  name: 'string',
  position: [
    number, // Export start
    number, // Name start
    number // Name end
  ]
}
```

Options are reserved.

#### `lex.constants`

| Constant   | Description                                                                                                                                                                                                              |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REQUIRE`  | CommonJS `require()`.                                                                                                                                                                                                    |
| `IMPORT`   | ES module `import`.                                                                                                                                                                                                      |
| `DYNAMIC`  | ES module `import()` if `IMPORT` is set.                                                                                                                                                                                 |
| `ADDON`    | CommonJS `require.addon()` if `REQUIRE` is set, or ES module `import.meta.addon()` if `IMPORT` is set.                                                                                                                   |
| `ASSET`    | CommonJS `require.asset()` if `REQUIRE` is set, or ES module `import.meta.asset()` if `IMPORT` is set.                                                                                                                   |
| `RESOLVE`  | CommonJS `require.resolve()` or `require.addon.resolve()` if `REQUIRE` and optionally `ADDON` are set, or ES module `import.meta.resolve()` or `import.meta.addon.resolve()` if `IMPORT` and optionally `ADDON` are set. |
| `REEXPORT` | Re-export of a CommonJS `require()` if `REQUIRE` is set, or ES module `export from` if `IMPORT` is set.                                                                                                                  |

## License

Apache-2.0
