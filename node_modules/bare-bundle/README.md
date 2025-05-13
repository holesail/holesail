# bare-bundle

Application bundle format for JavaScript, inspired by <https://github.com/electron/asar>.

```
npm i bare-bundle
```

## Format

```
[#!hashbang]
<header length><header><...files>
```

The header length is an integer literal denoting the total length of the header. The header itself is a JSON string literal of header length bytes and has the following format:

```js
{
  "version": 0,
  "id": null | "<string>",
  "main": null | "<url>",
  "imports": {
    "<from>": "<to>"
  },
  "resolutions": {
    "<url>": "<imports>"
  },
  "addons": ["<url>"],
  "assets": ["<url>"],
  "files": {
    "<url>": {
      "offset": number,
      "length": number,
      "mode": number
    }
  }
}
```

For each `<url>` in `files`, `offset` provides the byte offset to the file **after** the header and `length` provides the byte length of the file.

The bundle may optionally be prefixed with a hashbang, `#!`, for use with script interpreters. The hashbang is ignored during parsing.

## License

Apache-2.0
