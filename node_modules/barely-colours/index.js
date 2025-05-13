const KeyDecoder = require("bare-ansi-escapes");

const reset = KeyDecoder.modifierReset;

class BarelyColours {
  red(d) {
    return KeyDecoder.colorRed + d + reset;
  }

  black(d) {
    return KeyDecoder.colorBlack + d + reset;
  }

  green(d) {
    return KeyDecoder.colorGreen + d + reset;
  }

  yellow(d) {
    return KeyDecoder.colorYellow + d + reset;
  }

  blue(d) {
    return KeyDecoder.colorBlue + d + reset;
  }

  magenta(d) {
    return KeyDecoder.colorMagenta + d + reset;
  }

  cyan(d) {
    return KeyDecoder.colorCyan + d + reset;
  }

  white(d) {
    return KeyDecoder.colorWhite + d + reset;
  }

  brightBlack(d) {
    return KeyDecoder.colorBrightBlack + d + reset;
  }

  brightRed(d) {
    return KeyDecoder.colorBrightRed + d + reset;
  }

  brightGreen(d) {
    return KeyDecoder.colorBrightGreen + d + reset;
  }

  brightYellow(d) {
    return KeyDecoder.colorBrightYellow + d + reset;
  }

  brightBlue(d) {
    return KeyDecoder.colorBrightBlue + d + reset;
  }

  brightMagenta(d) {
    return KeyDecoder.colorBrightMagenta + d + reset;
  }

  brightCyan(d) {
    return KeyDecoder.colorBrightCyan + d + reset;
  }

  brightWhite(d) {
    return KeyDecoder.colorBrightWhite + d + reset;
  }

  bold(d) {
    return KeyDecoder.modifierBold + d + reset;
  }

  dim(d) {
    return KeyDecoder.modifierDim + d + reset;
  }

  italic(d) {
    return KeyDecoder.modifierItalic + d + reset;
  }

  underline(d) {
    return KeyDecoder.modifierUnderline + d + reset;
  }

  normal(d) {
    return KeyDecoder.modifierNormal + d + reset;
  }

  notItalic(d) {
    return KeyDecoder.modifierNotItalic + d + reset;
  }

  notUnderline(d) {
    return KeyDecoder.modifierNotUnderline + d + reset;
  }
}

const colours = new BarelyColours();

module.exports = colours;
