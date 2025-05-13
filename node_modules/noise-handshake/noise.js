const assert = require('nanoassert')
const b4a = require('b4a')

const SymmetricState = require('./symmetric-state')
const { HASHLEN } = require('./hkdf')

const PRESHARE_IS = Symbol('initiator static key preshared')
const PRESHARE_RS = Symbol('responder static key preshared')

const TOK_PSK = Symbol('psk')

const TOK_S = Symbol('s')
const TOK_E = Symbol('e')

const TOK_ES = Symbol('es')
const TOK_SE = Symbol('se')
const TOK_EE = Symbol('ee')
const TOK_SS = Symbol('ss')

const HANDSHAKES = Object.freeze({
  NN: [
    [TOK_E],
    [TOK_E, TOK_EE]
  ],
  NNpsk0: [
    [TOK_PSK, TOK_E],
    [TOK_E, TOK_EE]
  ],
  XX: [
    [TOK_E],
    [TOK_E, TOK_EE, TOK_S, TOK_ES],
    [TOK_S, TOK_SE]
  ],
  XXpsk0: [
    [TOK_PSK, TOK_E],
    [TOK_E, TOK_EE, TOK_S, TOK_ES],
    [TOK_S, TOK_SE]
  ],
  IK: [
    PRESHARE_RS,
    [TOK_E, TOK_ES, TOK_S, TOK_SS],
    [TOK_E, TOK_EE, TOK_SE]
  ]
})

class Writer {
  constructor () {
    this.size = 0
    this.buffers = []
  }

  push (b) {
    this.size += b.byteLength
    this.buffers.push(b)
  }

  end () {
    const all = b4a.alloc(this.size)
    let offset = 0
    for (const b of this.buffers) {
      all.set(b, offset)
      offset += b.byteLength
    }
    return all
  }
}

class Reader {
  constructor (buf) {
    this.offset = 0
    this.buffer = buf
  }

  shift (n) {
    const start = this.offset
    const end = this.offset += n
    if (end > this.buffer.byteLength) throw new Error('Insufficient bytes')
    return this.buffer.subarray(start, end)
  }

  end () {
    return this.shift(this.buffer.byteLength - this.offset)
  }
}

module.exports = class NoiseState extends SymmetricState {
  constructor (pattern, initiator, staticKeypair, opts = {}) {
    super(opts)

    this.s = staticKeypair || this.curve.generateKeyPair()
    this.e = null

    this.psk = null
    if (opts && opts.psk) this.psk = opts.psk

    this.re = null
    this.rs = null

    this.pattern = pattern
    this.handshake = HANDSHAKES[this.pattern].slice()

    this.isPskHandshake = !!this.psk && hasPskToken(this.handshake)

    this.protocol = b4a.from([
      'Noise',
      this.pattern,
      this.DH_ALG,
      this.CIPHER_ALG,
      'BLAKE2b'
    ].join('_'))

    this.initiator = initiator
    this.complete = false

    this.rx = null
    this.tx = null
    this.hash = null
  }

  initialise (prologue, remoteStatic) {
    if (this.protocol.byteLength <= HASHLEN) this.digest.set(this.protocol)
    else this.mixHash(this.protocol)

    this.chainingKey = b4a.from(this.digest)

    this.mixHash(prologue)

    while (!Array.isArray(this.handshake[0])) {
      const message = this.handshake.shift()

      // handshake steps should be as arrays, only
      // preshare tokens are provided otherwise
      assert(message === PRESHARE_RS || message === PRESHARE_IS,
        'Unexpected pattern')

      const takeRemoteKey = this.initiator
        ? message === PRESHARE_RS
        : message === PRESHARE_IS

      if (takeRemoteKey) this.rs = remoteStatic

      const key = takeRemoteKey ? this.rs : this.s.publicKey
      assert(key != null, 'Remote pubkey required')

      this.mixHash(key)
    }
  }

  final () {
    const [k1, k2] = this.split()

    this.tx = this.initiator ? k1 : k2
    this.rx = this.initiator ? k2 : k1

    this.complete = true
    this.hash = this.getHandshakeHash()

    this._clear()
  }

  recv (buf) {
    const r = new Reader(buf)

    for (const pattern of this.handshake.shift()) {
      switch (pattern) {
        case TOK_PSK :
          this.mixKeyAndHash(this.psk)
          break

        case TOK_E :
          this.re = r.shift(this.curve.PKLEN)
          this.mixHash(this.re)
          if (this.isPskHandshake) this.mixKeyNormal(this.re)
          break

        case TOK_S : {
          const klen = this.hasKey ? this.curve.PKLEN + 16 : this.curve.PKLEN
          this.rs = this.decryptAndHash(r.shift(klen))
          break
        }

        case TOK_EE :
        case TOK_ES :
        case TOK_SE :
        case TOK_SS : {
          const useStatic = keyPattern(pattern, this.initiator)

          const localKey = useStatic.local ? this.s : this.e
          const remoteKey = useStatic.remote ? this.rs : this.re

          this.mixKey(remoteKey, localKey)
          break
        }

        default :
          throw new Error('Unexpected message')
      }
    }

    const payload = this.decryptAndHash(r.end())

    if (!this.handshake.length) this.final()
    return payload
  }

  send (payload = b4a.alloc(0)) {
    const w = new Writer()

    for (const pattern of this.handshake.shift()) {
      switch (pattern) {
        case TOK_PSK :
          this.mixKeyAndHash(this.psk)
          break

        case TOK_E :
          if (this.e === null) this.e = this.curve.generateKeyPair()
          this.mixHash(this.e.publicKey)
          if (this.isPskHandshake) this.mixKeyNormal(this.e.publicKey)
          w.push(this.e.publicKey)
          break

        case TOK_S :
          w.push(this.encryptAndHash(this.s.publicKey))
          break

        case TOK_ES :
        case TOK_SE :
        case TOK_EE :
        case TOK_SS : {
          const useStatic = keyPattern(pattern, this.initiator)

          const localKey = useStatic.local ? this.s : this.e
          const remoteKey = useStatic.remote ? this.rs : this.re

          this.mixKey(remoteKey, localKey)
          break
        }

        default :
          throw new Error('Unexpected message')
      }
    }

    w.push(this.encryptAndHash(payload))
    const response = w.end()

    if (!this.handshake.length) this.final()
    return response
  }

  _clear () {
    super._clear()

    this.e.secretKey.fill(0)
    this.e.publicKey.fill(0)

    this.re.fill(0)

    this.e = null
    this.re = null
  }
}

function keyPattern (pattern, initiator) {
  const ret = {
    local: false,
    remote: false
  }

  switch (pattern) {
    case TOK_EE:
      return ret

    case TOK_ES:
      ret.local ^= !initiator
      ret.remote ^= initiator
      return ret

    case TOK_SE:
      ret.local ^= initiator
      ret.remote ^= !initiator
      return ret

    case TOK_SS:
      ret.local ^= 1
      ret.remote ^= 1
      return ret
  }
}

function hasPskToken (handshake) {
  return handshake.some(x => {
    return Array.isArray(x) && x.indexOf(TOK_PSK) !== -1
  })
}
