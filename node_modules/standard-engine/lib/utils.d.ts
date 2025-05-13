/*! standard-engine. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
/**
 * @template T
 * @param {T[]|T} value
 * @returns {T[]}
 */
export function ensureArray<T>(value: T | T[]): T[];
/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function ensureStringArrayValue(value: unknown): string[];
/**
 * @template T
 * @param {string|string[]} values
 * @param {{ [key: string]: T }} base
 * @returns {{ [key: string]: T|true }}
 */
export function stringArrayToObj<T>(values: string | string[], base?: {
    [key: string]: T;
}): {
    [key: string]: true | T;
};
//# sourceMappingURL=utils.d.ts.map