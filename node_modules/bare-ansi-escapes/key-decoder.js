const { Transform } = require('bare-stream')

const {
  constants: { ESC }
} = require('.')

// https://en.wikipedia.org/wiki/ANSI_escape_code#Terminal_input_sequences

module.exports = class KeyDecoder extends Transform {
  constructor(opts = {}) {
    const { encoding = 'utf8', escapeCodeTimeout = 500 } = opts

    super()

    this.encoding = encoding

    this._escapeDelay = escapeCodeTimeout
    this._escapeTimer = null

    this._parser = parseKeys(this)
    this._parser.next()
  }

  _transform(data, encoding, cb) {
    clearTimeout(this._escapeTimer)

    if (data[0] > 127 && data.length === 1) {
      data[0] -= 128
      data = ESC + data.toString(this.encoding)
    } else {
      data = data.toString(this.encoding)
    }

    let n = 0

    for (const c of data) {
      n += c.length

      this._parser.next(c)

      if (n === data.length && c === ESC) {
        this._escapeTimer = setTimeout(
          this._escape.bind(this),
          this._escapeDelay
        )
      }
    }

    cb(null)
  }

  _escape() {
    this._parser.next('')
  }
}

class Key {
  constructor(name, sequence, ctrl, meta, shift) {
    this.name = typeof name === 'number' ? String.fromCharCode(name) : name
    this.sequence = sequence
    this.ctrl = ctrl
    this.meta = meta
    this.shift = shift
  }
}

function charLengthAt(str, i) {
  if (str.length <= i) {
    return 1
  }

  return str.codePointAt(i) >= 0x10000 ? 2 : 1
}

function* parseKeys(stream) {
  while (true) {
    let c = yield
    let s = c
    let escaped = false

    let name = null
    let ctrl = false
    let meta = false
    let shift = false

    if (c === ESC) {
      escaped = true

      s += c = yield

      if (c === ESC) {
        s += c = yield
      }
    }

    if (escaped && (c === 'O' || c === '[')) {
      let code = c
      let modifier = 0

      if (c === 'O') {
        s += c = yield

        if (c >= '0' && c <= '9') {
          modifier = (c >> 0) - 1
          s += c = yield
        }

        code += c
      } else if (c === '[') {
        s += c = yield

        if (c === '[') {
          code += c
          s += c = yield
        }

        const start = s.length - 1

        if (c >= '0' && c <= '9') {
          s += c = yield

          if (c >= '0' && c <= '9') {
            s += c = yield

            if (c >= '0' && c <= '9') {
              s += c = yield
            }
          }
        }

        if (c === ';') {
          s += c = yield

          if (c >= '0' && c <= '9') {
            s += yield
          }
        }

        const cmd = s.slice(start)

        let match

        if ((match = /^(?:(\d\d?)(?:;(\d))?([~^$])|(\d{3}~))$/.exec(cmd))) {
          if (match[4]) {
            code += match[4]
          } else {
            code += match[1] + match[3]
            modifier = (match[2] || 1) - 1
          }
        } else if ((match = /^((\d;)?(\d))?([A-Za-z])$/.exec(cmd))) {
          code += match[4]
          modifier = (match[3] || 1) - 1
        } else {
          code += cmd
        }
      }

      ctrl = !!(modifier & 4)
      meta = !!(modifier & 10)
      shift = !!(modifier & 1)

      switch (code) {
        /* xterm/gnome ESC [ letter (with modifier) */
        case '[P':
          name = 'f1'
          break
        case '[Q':
          name = 'f2'
          break
        case '[R':
          name = 'f3'
          break
        case '[S':
          name = 'f4'
          break

        /* xterm/gnome ESC O letter (without modifier) */
        case 'OP':
          name = 'f1'
          break
        case 'OQ':
          name = 'f2'
          break
        case 'OR':
          name = 'f3'
          break
        case 'OS':
          name = 'f4'
          break

        /* xterm/rxvt ESC [ number ~ */
        case '[11~':
          name = 'f1'
          break
        case '[12~':
          name = 'f2'
          break
        case '[13~':
          name = 'f3'
          break
        case '[14~':
          name = 'f4'
          break

        /* paste bracket mode */
        case '[200~':
          name = 'paste-start'
          break
        case '[201~':
          name = 'paste-end'
          break

        /* from Cygwin and used in libuv */
        case '[[A':
          name = 'f1'
          break
        case '[[B':
          name = 'f2'
          break
        case '[[C':
          name = 'f3'
          break
        case '[[D':
          name = 'f4'
          break
        case '[[E':
          name = 'f5'
          break

        /* common */
        case '[15~':
          name = 'f5'
          break
        case '[17~':
          name = 'f6'
          break
        case '[18~':
          name = 'f7'
          break
        case '[19~':
          name = 'f8'
          break
        case '[20~':
          name = 'f9'
          break
        case '[21~':
          name = 'f10'
          break
        case '[23~':
          name = 'f11'
          break
        case '[24~':
          name = 'f12'
          break

        /* xterm ESC [ letter */
        case '[A':
          name = 'up'
          break
        case '[B':
          name = 'down'
          break
        case '[C':
          name = 'right'
          break
        case '[D':
          name = 'left'
          break
        case '[E':
          name = 'clear'
          break
        case '[F':
          name = 'end'
          break
        case '[H':
          name = 'home'
          break

        /* xterm/gnome ESC O letter */
        case 'OA':
          name = 'up'
          break
        case 'OB':
          name = 'down'
          break
        case 'OC':
          name = 'right'
          break
        case 'OD':
          name = 'left'
          break
        case 'OE':
          name = 'clear'
          break
        case 'OF':
          name = 'end'
          break
        case 'OH':
          name = 'home'
          break

        /* xterm/rxvt ESC [ number ~ */
        case '[1~':
          name = 'home'
          break
        case '[2~':
          name = 'insert'
          break
        case '[3~':
          name = 'delete'
          break
        case '[4~':
          name = 'end'
          break
        case '[5~':
          name = 'pageup'
          break
        case '[6~':
          name = 'pagedown'
          break

        /* putty */
        case '[[5~':
          name = 'pageup'
          break
        case '[[6~':
          name = 'pagedown'
          break

        /* rxvt */
        case '[7~':
          name = 'home'
          break
        case '[8~':
          name = 'end'
          break

        /* rxvt keys with modifiers */
        case '[a':
          name = 'up'
          shift = true
          break
        case '[b':
          name = 'down'
          shift = true
          break
        case '[c':
          name = 'right'
          shift = true
          break
        case '[d':
          name = 'left'
          shift = true
          break
        case '[e':
          name = 'clear'
          shift = true
          break

        case '[2$':
          name = 'insert'
          shift = true
          break
        case '[3$':
          name = 'delete'
          shift = true
          break
        case '[5$':
          name = 'pageup'
          shift = true
          break
        case '[6$':
          name = 'pagedown'
          shift = true
          break
        case '[7$':
          name = 'home'
          shift = true
          break
        case '[8$':
          name = 'end'
          shift = true
          break

        case 'Oa':
          name = 'up'
          ctrl = true
          break
        case 'Ob':
          name = 'down'
          ctrl = true
          break
        case 'Oc':
          name = 'right'
          ctrl = true
          break
        case 'Od':
          name = 'left'
          ctrl = true
          break
        case 'Oe':
          name = 'clear'
          ctrl = true
          break

        case '[2^':
          name = 'insert'
          ctrl = true
          break
        case '[3^':
          name = 'delete'
          ctrl = true
          break
        case '[5^':
          name = 'pageup'
          ctrl = true
          break
        case '[6^':
          name = 'pagedown'
          ctrl = true
          break
        case '[7^':
          name = 'home'
          ctrl = true
          break
        case '[8^':
          name = 'end'
          ctrl = true
          break

        case '[Z':
          name = 'tab'
          shift = true
          break
        default:
          name = 'undefined'
          break
      }
    } else if (c === '\r') {
      name = 'return'
      meta = escaped
    } else if (c === '\n') {
      name = 'linefeed'
      meta = escaped
    } else if (c === '\t') {
      name = 'tab'
      meta = escaped
    } else if (c === '\b' || c === '\x7f') {
      name = 'backspace'
      meta = escaped
    } else if (c === ESC) {
      name = 'escape'
      meta = escaped
    } else if (c === ' ') {
      name = 'space'
      meta = escaped
    } else if (!escaped && c <= '\x1a') {
      name = String.fromCharCode(c.charCodeAt(0) + 'a'.charCodeAt(0) - 1)
      ctrl = true
    } else if (/^[0-9A-Za-z]$/.exec(c) !== null) {
      name = c.toLowerCase()
      shift = /^[A-Z]$/.exec(c) !== null
      meta = escaped
    } else if (escaped) {
      name = c.length ? null : 'escape'
      meta = true
    }

    const sequence = s

    if (
      s.length > 0 &&
      (name !== null || escaped || charLengthAt(s, 0) === s.length)
    ) {
      stream.push(
        new Key(name === null ? sequence : name, sequence, ctrl, meta, shift)
      )
    }
  }
}
