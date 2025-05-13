#!/usr/bin/env node
export = cli;
/**
 * @typedef StandardCliOptions
 * @property {import('../').StandardEngine} [standardEngine]
 * @property {string} [cmd]
 * @property {string} [tagline]
 * @property {string} [homepage]
 * @property {string} [bugs]
 */
/**
 * @param {Omit<import('../').StandardEngineOptions, 'cmd'> & StandardCliOptions} rawOpts
 * @returns {void}
 */
declare function cli(rawOpts: Omit<import('../').StandardEngineOptions, 'cmd'> & StandardCliOptions): void;
declare namespace cli {
    export { StandardCliOptions };
}
type StandardCliOptions = {
    standardEngine?: import("../").StandardEngine | undefined;
    cmd?: string | undefined;
    tagline?: string | undefined;
    homepage?: string | undefined;
    bugs?: string | undefined;
};
//# sourceMappingURL=cmd.d.ts.map