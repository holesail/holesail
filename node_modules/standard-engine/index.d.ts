export const cli: typeof import("./bin/cmd");
export type EslintOptions = import('eslint').ESLint.Options;
export type BaseLintOptions = Omit<import('./lib/resolve-eslint-config').ResolveOptions, 'cmd' | 'cwd'>;
export type StandardEngineOptions = {
    cmd: string;
    eslint: typeof import("eslint");
    cwd?: string | undefined;
    eslintConfig?: import("eslint").ESLint.Options | undefined;
    resolveEslintConfig?: import("./lib/resolve-eslint-config").CustomEslintConfigResolver | undefined;
    version?: string | undefined;
};
/** @typedef {import('eslint').ESLint.Options} EslintOptions */
/** @typedef {Omit<import('./lib/resolve-eslint-config').ResolveOptions, 'cmd'|'cwd'>} BaseLintOptions */
/**
 * @typedef StandardEngineOptions
 * @property {string} cmd
 * @property {import('eslint')} eslint
 * @property {string} [cwd]
 * @property {EslintOptions} [eslintConfig]
 * @property {import('./lib/resolve-eslint-config').CustomEslintConfigResolver} [resolveEslintConfig]
 * @property {string} [version]
 */
export class StandardEngine {
    /**
     * @param {StandardEngineOptions} opts
     */
    constructor(opts: StandardEngineOptions);
    /** @type {string} */
    cmd: string;
    /** @type {import('eslint')} */
    eslint: typeof import("eslint");
    /** @type {string} */
    cwd: string;
    customEslintConfigResolver: import("./lib/resolve-eslint-config").CustomEslintConfigResolver | undefined;
    /** @type {EslintOptions} */
    eslintConfig: EslintOptions;
    /**
     * Lint text to enforce JavaScript Style.
     *
     * @param {string} text file text to lint
     * @param {Omit<BaseLintOptions, 'ignore'|'noDefaultIgnore'> & { filename?: string }} [opts] base options + path of file containing the text being linted
     * @returns {Promise<import('eslint').ESLint.LintResult[]>}
     */
    lintText(text: string, { filename: filePath, ...opts }?: (Omit<BaseLintOptions, "ignore" | "noDefaultIgnore"> & {
        filename?: string | undefined;
    }) | undefined): Promise<import('eslint').ESLint.LintResult[]>;
    /**
     * Lint files to enforce JavaScript Style.
     *
     * @param {Array<string>} files file globs to lint
     * @param {BaseLintOptions & { cwd?: string }} [opts] base options + file globs to ignore (has sane defaults) + current working directory (default: process.cwd())
     * @returns {Promise<import('eslint').ESLint.LintResult[]>}
     */
    lintFiles(files: Array<string>, opts?: (BaseLintOptions & {
        cwd?: string | undefined;
    }) | undefined): Promise<import('eslint').ESLint.LintResult[]>;
    /**
     * @param {BaseLintOptions & { cwd?: string }} [opts]
     * @returns {EslintOptions}
     */
    resolveEslintConfig(opts?: (BaseLintOptions & {
        cwd?: string | undefined;
    }) | undefined): EslintOptions;
}
//# sourceMappingURL=index.d.ts.map