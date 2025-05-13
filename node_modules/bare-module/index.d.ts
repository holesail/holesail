import Buffer from 'bare-buffer'
import URL from 'bare-url'
import Bundle from 'bare-bundle'
import {
  type Builtins,
  type Conditions,
  type ImportsMap,
  type ResolutionsMap
} from 'bare-module-resolve'
import Protocol from './lib/protocol'
import constants from './lib/constants'

interface Cache {
  [href: string]: Module
}

interface Attributes {
  type: Lowercase<keyof typeof constants.types>
}

interface Options {
  attributes?: Attributes
  builtins?: Builtins
  cache?: Cache
  conditions?: Conditions
  defaultType?: number
  imports?: ImportsMap
  main?: Module
  protocol?: Protocol
  referrer?: Module
  resolutions?: ResolutionsMap
  type?: number
}

interface LoadOptions extends Options {
  isDynamicImport?: boolean
  isImport?: boolean
}

interface ResolveOptions extends Options {
  isImport?: boolean
}

interface Module {
  readonly builtins: Builtins
  readonly cache: Cache
  readonly conditions: Conditions
  readonly defaultType: number
  readonly dirname: string
  exports: unknown
  readonly filename: string
  readonly id: string
  readonly imports: ImportsMap
  readonly main: Module
  readonly path: string
  readonly protocol: Protocol
  readonly resolutions: ResolutionsMap
  readonly type: number
  readonly url: URL

  destroy(): void
}

declare class Module {
  static readonly protocol: Protocol
  static readonly cache: Cache

  static load(url: URL, opts: LoadOptions): Module
  static load(
    url: URL,
    source?: Buffer | string | Bundle | null,
    opts?: LoadOptions
  ): Module

  static resolve(specifier: string, parentURL: URL, opts?: ResolveOptions): URL

  static asset(specifier: string, parentURL: URL, opts?: Options): URL

  constructor(url: URL)
}

declare namespace Module {
  export {
    type Attributes,
    type Cache,
    type Options,
    type LoadOptions,
    type ResolveOptions,
    Protocol,
    Bundle,
    constants
  }

  export const builtinModules: Module[]

  export function isBuiltin(): boolean

  export interface CreateRequireOptions extends Options {
    module?: Module
  }

  export interface RequireOptions {
    with?: Attributes
  }

  export interface RequireAddon {
    (specifier?: string, parentURL?: URL): string
    host: string
    resolve: (specifier: string, parentURL?: URL) => unknown
  }

  export interface Require {
    (parentURL: string | URL, opts?: RequireOptions): unknown
    main: Module
    cache: Cache
    resolve: (specifier: string, parentURL?: URL) => string
    addon: RequireAddon
    asset: (specifier: string, parentURL?: URL) => string
  }

  export function createRequire(
    parentURL: string | URL,
    opts?: CreateRequireOptions
  ): Require
}

export = Module
