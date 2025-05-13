const ESC = '\x1b'
const CSI = ESC + '['
const SGR = (n) => CSI + n + 'm'

exports.constants = {
  ESC,
  CSI,
  SGR
}

// https://en.wikipedia.org/wiki/ANSI_escape_code#CSI_(Control_Sequence_Introducer)_sequences

exports.cursorHide = CSI + '?25l'
exports.cursorShow = CSI + '?25h'

exports.cursorUp = function cursorUp(n = 1) {
  return CSI + n + 'A'
}

exports.cursorDown = function cursorDown(n = 1) {
  return CSI + n + 'B'
}

exports.cursorForward = function cursorForward(n = 1) {
  return CSI + n + 'C'
}

exports.cursorBack = function cursorBack(n = 1) {
  return CSI + n + 'D'
}

exports.cursorNextLine = function cursorNextLine(n = 1) {
  return CSI + n + 'E'
}

exports.cursorPreviousLine = function cursorPreviousLine(n = 1) {
  return CSI + n + 'F'
}

exports.cursorPosition = function cursorPosition(column, row = 0) {
  if (row === 0) return CSI + (column + 1) + 'G'

  return CSI + (row + 1) + ';' + (column + 1) + 'H'
}

exports.eraseDisplayEnd = CSI + 'J'
exports.eraseDisplayStart = CSI + '1J'
exports.eraseDisplay = CSI + '2J'
exports.eraseLineEnd = CSI + 'K'
exports.eraseLineStart = CSI + '1K'
exports.eraseLine = CSI + '2K'

exports.scrollUp = function scrollUp(n = 1) {
  return CSI + n + 'S'
}

exports.scrollDown = function scrollDown(n = 1) {
  return CSI + n + 'T'
}

// https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters

exports.modifierReset = SGR(0)
exports.modifierBold = SGR(1)
exports.modifierDim = SGR(2)
exports.modifierItalic = SGR(3)
exports.modifierUnderline = SGR(4)
exports.modifierNormal = SGR(22)
exports.modifierNotItalic = SGR(23)
exports.modifierNotUnderline = SGR(24)

// https://en.wikipedia.org/wiki/ANSI_escape_code#Colors

exports.colorBlack = SGR(30)
exports.colorRed = SGR(31)
exports.colorGreen = SGR(32)
exports.colorYellow = SGR(33)
exports.colorBlue = SGR(34)
exports.colorMagenta = SGR(35)
exports.colorCyan = SGR(36)
exports.colorWhite = SGR(37)
exports.colorDefault = SGR(39)
exports.colorBrightBlack = SGR(90)
exports.colorBrightRed = SGR(91)
exports.colorBrightGreen = SGR(92)
exports.colorBrightYellow = SGR(93)
exports.colorBrightBlue = SGR(94)
exports.colorBrightMagenta = SGR(95)
exports.colorBrightCyan = SGR(96)
exports.colorBrightWhite = SGR(97)
