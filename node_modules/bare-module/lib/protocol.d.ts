import URL from 'bare-url'
import Buffer from 'bare-buffer'
import { type ImportsMap } from 'bare-module-resolve'

interface ModuleProtocol {
  preresolve(specifier: string, parentURL: URL): string

  postresolve(url: URL): URL

  resolve(specifier: string, parentURL: URL, imports: ImportsMap): URL

  exists(url: URL, type: number): boolean

  read(url: URL): Buffer | string | null

  addon(url: URL): URL

  asset(url: URL): URL

  extend(methods: Partial<ModuleProtocol>): ModuleProtocol
}

declare class ModuleProtocol {
  constructor(methods?: Partial<ModuleProtocol>, context?: ModuleProtocol)
}

export = ModuleProtocol
