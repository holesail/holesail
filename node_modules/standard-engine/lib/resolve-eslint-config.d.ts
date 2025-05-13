export type EslintOptions = import('../').EslintOptions;
export type ResolveOptions = {
    cmd: string;
    cwd: string;
    /**
     * automatically fix problems
     */
    fix?: boolean | undefined;
    ignore?: string | string[] | undefined;
    extensions?: string | string[] | undefined;
    /**
     * custom global variables to declare
     */
    globals?: string | string[] | undefined;
    global?: string | string[] | undefined;
    /**
     * custom eslint plugins
     */
    plugins?: string | string[] | undefined;
    plugin?: string | string[] | undefined;
    /**
     * custom eslint environment
     */
    envs?: string | string[] | undefined;
    env?: string | string[] | undefined;
    /**
     * custom js parser (e.g. babel-eslint)
     */
    parser?: string | undefined;
    /**
     * use .gitignore? (default: true)
     */
    useGitIgnore?: boolean | undefined;
    /**
     * use options from nearest package.json? (default: true)
     */
    usePackageJson?: boolean | undefined;
    noDefaultIgnore?: boolean | undefined;
    noDefaultExtensions?: boolean | undefined;
};
export type CustomEslintConfigResolver = (eslintConfig: Readonly<EslintOptions>, opts: Readonly<ResolveOptions>, packageOpts: import('pkg-conf').Config, rootDir: string) => EslintOptions;
/**
 * @typedef ResolveOptions
 * @property {string} cmd
 * @property {string} cwd
 * @property {boolean} [fix]                automatically fix problems
 * @property {string[]|string} [ignore]
 * @property {string[]|string} [extensions]
 * @property {string[]|string} [globals]    custom global variables to declare
 * @property {string[]|string} [global]
 * @property {string[]|string} [plugins]    custom eslint plugins
 * @property {string[]|string} [plugin]
 * @property {string[]|string} [envs]       custom eslint environment
 * @property {string[]|string} [env]
 * @property {string} [parser]              custom js parser (e.g. babel-eslint)
 * @property {boolean} [useGitIgnore]       use .gitignore? (default: true)
 * @property {boolean} [usePackageJson]     use options from nearest package.json? (default: true)
 * @property {boolean} [noDefaultIgnore]
 * @property {boolean} [noDefaultExtensions]
 */
/**
 * @callback CustomEslintConfigResolver
 * @param {Readonly<EslintOptions>} eslintConfig
 * @param {Readonly<ResolveOptions>} opts
 * @param {import('pkg-conf').Config} packageOpts
 * @param {string} rootDir
 * @returns {EslintOptions}
 */
/**
 * @param {Readonly<ResolveOptions>} rawOpts
 * @param {Readonly<EslintOptions>} baseEslintConfig
 * @param {CustomEslintConfigResolver} [customEslintConfigResolver]
 * @returns {EslintOptions}
 */
export function resolveEslintConfig(rawOpts: Readonly<ResolveOptions>, baseEslintConfig: Readonly<EslintOptions>, customEslintConfigResolver?: CustomEslintConfigResolver | undefined): EslintOptions;
//# sourceMappingURL=resolve-eslint-config.d.ts.map