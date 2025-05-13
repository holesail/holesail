import Buffer, { BufferEncoding } from 'bare-buffer'

interface Import {
  specifier: string
  type: number
  names: string[]
  position: [importStart: number, specifierStart: number, specifierEnd: number]
}

interface Export {
  name: string
  position: [exportStart: number, nameStart: number, nameEnd: number]
}

declare function lex(
  input: string | Buffer,
  encoding?: BufferEncoding
): {
  imports: Import[]
  exports: Export[]
}

declare namespace lex {
  export { type Import, type Export }

  export const constants: {
    REQUIRE: number
    IMPORT: number
    DYNAMIC: number
    ADDON: number
    ASSET: number
    RESOLVE: number
    REEXPORT: number
  }
}

export = lex
