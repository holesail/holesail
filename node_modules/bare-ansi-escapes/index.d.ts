export const constants: { ESC: string; CSI: string; SGR: (n: number) => string }

export const cursorHide: string
export const cursorShow: string

export function cursorUp(n?: number): string
export function cursorDown(n?: number): string
export function cursorForward(n?: number): string
export function cursorBack(n?: number): string
export function cursorNextLine(n?: number): string
export function cursorPreviousLine(n?: number): string

export function cursorPosition(column: number, row?: number): string

export const eraseDisplayEnd: string
export const eraseDisplayStart: string
export const eraseDisplay: string
export const eraseLineEnd: string
export const eraseLineStart: string
export const eraseLine: string

export function scrollUp(n?: number): string
export function scrollDown(n?: number): string

export const modifierReset: string
export const modifierBold: string
export const modifierDim: string
export const modifierItalic: string
export const modifierUnderline: string
export const modifierNormal: string
export const modifierNotItalic: string
export const modifierNotUnderline: string

export const colorBlack: string
export const colorRed: string
export const colorGreen: string
export const colorYellow: string
export const colorBlue: string
export const colorMagenta: string
export const colorCyan: string
export const colorWhite: string
export const colorDefault: string
export const colorBrightBlack: string
export const colorBrightRed: string
export const colorBrightGreen: string
export const colorBrightYellow: string
export const colorBrightBlue: string
export const colorBrightMagenta: string
export const colorBrightCyan: string
export const colorBrightWhite: string
