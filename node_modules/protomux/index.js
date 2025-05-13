const b4a = require('b4a')
const c = require('compact-encoding')
const queueTick = require('queue-tick')
const safetyCatch = require('safety-catch')
const unslab = require('unslab')

const MAX_BUFFERED = 32768
const MAX_BACKLOG = Infinity // TODO: impl "open" backpressure
const MAX_BATCH = 8 * 1024 * 1024

class Channel {
  constructor (mux, info, userData, protocol, aliases, id, handshake, messages, onopen, onclose, ondestroy, ondrain) {
    this.userData = userData
    this.protocol = protocol
    this.aliases = aliases
    this.id = id
    this.handshake = null
    this.messages = []

    this.opened = false
    this.closed = false
    this.destroyed = false

    this.onopen = onopen
    this.onclose = onclose
    this.ondestroy = ondestroy
    this.ondrain = ondrain

    this._handshake = handshake
    this._mux = mux
    this._info = info
    this._localId = 0
    this._remoteId = 0
    this._active = 0
    this._extensions = null

    this._decBound = this._dec.bind(this)
    this._decAndDestroyBound = this._decAndDestroy.bind(this)

    this._openedPromise = null
    this._openedResolve = null

    this._destroyedPromise = null
    this._destroyedResolve = null

    for (const m of messages) this.addMessage(m)
  }

  get drained () {
    return this._mux.drained
  }

  fullyOpened () {
    if (this.opened) return Promise.resolve(true)
    if (this.closed) return Promise.resolve(false)
    if (this._openedPromise) return this._openedPromise

    this._openedPromise = new Promise((resolve) => { this._openedResolve = resolve })
    return this._openedPromise
  }

  fullyClosed () {
    if (this.destroyed) return Promise.resolve()
    if (this._destroyedPromise) return this._destroyedPromise

    this._destroyedPromise = new Promise((resolve) => { this._destroyedResolve = resolve })
    return this._destroyedPromise
  }

  open (handshake) {
    const id = this._mux._free.length > 0
      ? this._mux._free.pop()
      : this._mux._local.push(null) - 1

    this._info.opened++
    this._info.lastChannel = this
    this._localId = id + 1
    this._mux._local[id] = this

    if (this._remoteId === 0) {
      this._info.outgoing.push(this._localId)
    }

    const state = { buffer: null, start: 2, end: 2 }

    c.uint.preencode(state, this._localId)
    c.string.preencode(state, this.protocol)
    c.buffer.preencode(state, this.id)
    if (this._handshake) this._handshake.preencode(state, handshake)

    state.buffer = this._mux._alloc(state.end)

    state.buffer[0] = 0
    state.buffer[1] = 1
    c.uint.encode(state, this._localId)
    c.string.encode(state, this.protocol)
    c.buffer.encode(state, this.id)
    if (this._handshake) this._handshake.encode(state, handshake)

    this._mux._write0(state.buffer)
  }

  _dec () {
    if (--this._active === 0 && this.closed === true) this._destroy()
  }

  _decAndDestroy (err) {
    this._dec()
    this._mux._safeDestroy(err)
  }

  _fullyOpenSoon () {
    this._mux._remote[this._remoteId - 1].session = this
    queueTick(this._fullyOpen.bind(this))
  }

  _fullyOpen () {
    if (this.opened === true || this.closed === true) return

    const remote = this._mux._remote[this._remoteId - 1]

    this.opened = true
    this.handshake = this._handshake ? this._handshake.decode(remote.state) : null
    this._track(this.onopen(this.handshake, this))

    remote.session = this
    remote.state = null
    if (remote.pending !== null) this._drain(remote)

    this._resolveOpen(true)
  }

  _resolveOpen (opened) {
    if (this._openedResolve !== null) {
      this._openedResolve(opened)
      this._openedResolve = this._openedPromise = null
    }
  }

  _resolveDestroyed () {
    if (this._destroyedResolve !== null) {
      this._destroyedResolve()
      this._destroyedResolve = this._destroyedPromise = null
    }
  }

  _drain (remote) {
    for (let i = 0; i < remote.pending.length; i++) {
      const p = remote.pending[i]
      this._mux._buffered -= byteSize(p.state)
      this._recv(p.type, p.state)
    }

    remote.pending = null
    this._mux._resumeMaybe()
  }

  _track (p) {
    if (isPromise(p) === true) {
      this._active++
      return p.then(this._decBound, this._decAndDestroyBound)
    }

    return null
  }

  _close (isRemote) {
    if (this.closed === true) return
    this.closed = true

    this._info.opened--
    if (this._info.lastChannel === this) this._info.lastChannel = null

    if (this._remoteId > 0) {
      this._mux._remote[this._remoteId - 1] = null
      this._remoteId = 0
      // If remote has acked, we can reuse the local id now
      // otherwise, we need to wait for the "ack" to arrive
      this._mux._free.push(this._localId - 1)
    }

    this._mux._local[this._localId - 1] = null
    this._localId = 0

    this._mux._gc(this._info)
    this._track(this.onclose(isRemote, this))

    if (this._active === 0) this._destroy()

    this._resolveOpen(false)
  }

  _destroy () {
    if (this.destroyed === true) return
    this.destroyed = true
    this._track(this.ondestroy(this))
    this._resolveDestroyed()
  }

  _recv (type, state) {
    if (type < this.messages.length) {
      const m = this.messages[type]
      const p = m.recv(state, this)
      if (m.autoBatch === true) return p
    }
    return null
  }

  cork () {
    this._mux.cork()
  }

  uncork () {
    this._mux.uncork()
  }

  close () {
    if (this.closed === true) return

    const state = { buffer: null, start: 2, end: 2 }

    c.uint.preencode(state, this._localId)

    state.buffer = this._mux._alloc(state.end)

    state.buffer[0] = 0
    state.buffer[1] = 3
    c.uint.encode(state, this._localId)

    this._close(false)
    this._mux._write0(state.buffer)
  }

  addMessage (opts) {
    if (!opts) return this._skipMessage()

    const type = this.messages.length
    const autoBatch = opts.autoBatch !== false
    const encoding = opts.encoding || c.raw
    const onmessage = opts.onmessage || noop

    const s = this
    const typeLen = encodingLength(c.uint, type)

    const m = {
      type,
      autoBatch,
      encoding,
      onmessage,
      recv (state, session) {
        return session._track(m.onmessage(encoding.decode(state), session))
      },
      send (m, session = s) {
        if (session.closed === true) return false

        const mux = session._mux
        const state = { buffer: null, start: 0, end: typeLen }

        if (mux._batch !== null) {
          encoding.preencode(state, m)
          state.buffer = mux._alloc(state.end)

          c.uint.encode(state, type)
          encoding.encode(state, m)

          mux._pushBatch(session._localId, state.buffer)
          return true
        }

        c.uint.preencode(state, session._localId)
        encoding.preencode(state, m)

        state.buffer = mux._alloc(state.end)

        c.uint.encode(state, session._localId)
        c.uint.encode(state, type)
        encoding.encode(state, m)

        mux.drained = mux.stream.write(state.buffer)

        return mux.drained
      }
    }

    this.messages.push(m)

    return m
  }

  _skipMessage () {
    const type = this.messages.length
    const m = {
      type,
      encoding: c.raw,
      onmessage: noop,
      recv (state, session) {},
      send (m, session) {}
    }

    this.messages.push(m)
    return m
  }
}

module.exports = class Protomux {
  constructor (stream, { alloc } = {}) {
    if (stream.userData === null) stream.userData = this

    this.isProtomux = true
    this.stream = stream
    this.corked = 0
    this.drained = true

    this._alloc = alloc || (typeof stream.alloc === 'function' ? stream.alloc.bind(stream) : b4a.allocUnsafe)
    this._safeDestroyBound = this._safeDestroy.bind(this)
    this._uncorkBound = this.uncork.bind(this)

    this._remoteBacklog = 0
    this._buffered = 0
    this._paused = false
    this._remote = []
    this._local = []
    this._free = []
    this._batch = null
    this._batchState = null

    this._infos = new Map()
    this._notify = new Map()

    this.stream.on('data', this._ondata.bind(this))
    this.stream.on('drain', this._ondrain.bind(this))
    this.stream.on('end', this._onend.bind(this))
    this.stream.on('error', noop) // we handle this in "close"
    this.stream.on('close', this._shutdown.bind(this))
  }

  static from (stream, opts) {
    if (stream.userData && stream.userData.isProtomux) return stream.userData
    if (stream.isProtomux) return stream
    return new this(stream, opts)
  }

  static isProtomux (mux) {
    return typeof mux === 'object' && mux.isProtomux === true
  }

  * [Symbol.iterator] () {
    for (const session of this._local) {
      if (session !== null) yield session
    }
  }

  isIdle () {
    return this._local.length === this._free.length
  }

  cork () {
    if (++this.corked === 1) {
      this._batch = []
      this._batchState = { buffer: null, start: 0, end: 1 }
    }
  }

  uncork () {
    if (--this.corked === 0) {
      this._sendBatch(this._batch, this._batchState)
      this._batch = null
      this._batchState = null
    }
  }

  getLastChannel ({ protocol, id = null }) {
    const key = toKey(protocol, id)
    const info = this._infos.get(key)
    if (info) return info.lastChannel
    return null
  }

  pair ({ protocol, id = null }, notify) {
    this._notify.set(toKey(protocol, id), notify)
  }

  unpair ({ protocol, id = null }) {
    this._notify.delete(toKey(protocol, id))
  }

  opened ({ protocol, id = null }) {
    const key = toKey(protocol, id)
    const info = this._infos.get(key)
    return info ? info.opened > 0 : false
  }

  createChannel ({ userData = null, protocol, aliases = [], id = null, unique = true, handshake = null, messages = [], onopen = noop, onclose = noop, ondestroy = noop, ondrain = noop }) {
    if (this.stream.destroyed) return null

    const info = this._get(protocol, id, aliases)
    if (unique && info.opened > 0) return null

    if (info.incoming.length === 0) {
      return new Channel(this, info, userData, protocol, aliases, id, handshake, messages, onopen, onclose, ondestroy, ondrain)
    }

    this._remoteBacklog--

    const remoteId = info.incoming.shift()
    const r = this._remote[remoteId - 1]
    if (r === null) return null

    const session = new Channel(this, info, userData, protocol, aliases, id, handshake, messages, onopen, onclose, ondestroy, ondrain)

    session._remoteId = remoteId
    session._fullyOpenSoon()

    return session
  }

  _pushBatch (localId, buffer) {
    if (this._batchState.end >= MAX_BATCH) {
      this._sendBatch(this._batch, this._batchState)
      this._batch = []
      this._batchState = { buffer: null, start: 0, end: 1 }
    }

    if (this._batch.length === 0 || this._batch[this._batch.length - 1].localId !== localId) {
      this._batchState.end++
      c.uint.preencode(this._batchState, localId)
    }
    c.buffer.preencode(this._batchState, buffer)
    this._batch.push({ localId, buffer })
  }

  _sendBatch (batch, state) {
    if (batch.length === 0) return

    let prev = batch[0].localId

    state.buffer = this._alloc(state.end)
    state.buffer[state.start++] = 0
    state.buffer[state.start++] = 0

    c.uint.encode(state, prev)

    for (let i = 0; i < batch.length; i++) {
      const b = batch[i]
      if (prev !== b.localId) {
        state.buffer[state.start++] = 0
        c.uint.encode(state, (prev = b.localId))
      }
      c.buffer.encode(state, b.buffer)
    }

    this.drained = this.stream.write(state.buffer)
  }

  _get (protocol, id, aliases = []) {
    const key = toKey(protocol, id)

    let info = this._infos.get(key)
    if (info) return info

    info = { key, protocol, aliases: [], id, pairing: 0, opened: 0, incoming: [], outgoing: [], lastChannel: null }
    this._infos.set(key, info)

    for (const alias of aliases) {
      const key = toKey(alias, id)
      info.aliases.push(key)

      this._infos.set(key, info)
    }

    return info
  }

  _gc (info) {
    if (info.opened === 0 && info.outgoing.length === 0 && info.incoming.length === 0) {
      this._infos.delete(info.key)

      for (const alias of info.aliases) this._infos.delete(alias)
    }
  }

  _ondata (buffer) {
    if (buffer.byteLength === 0) return // ignore empty frames...
    try {
      const state = { buffer, start: 0, end: buffer.byteLength }
      this._decode(c.uint.decode(state), state)
    } catch (err) {
      this._safeDestroy(err)
    }
  }

  _ondrain () {
    this.drained = true

    for (const s of this._local) {
      if (s !== null) s._track(s.ondrain(s))
    }
  }

  _onend () { // TODO: support half open mode for the users who wants that here
    this.stream.end()
  }

  _decode (remoteId, state) {
    const type = c.uint.decode(state)

    if (remoteId === 0) {
      return this._oncontrolsession(type, state)
    }

    const r = remoteId <= this._remote.length ? this._remote[remoteId - 1] : null

    // if the channel is closed ignore - could just be a pipeline message...
    if (r === null) return null

    if (r.pending !== null) {
      this._bufferMessage(r, type, state)
      return null
    }

    return r.session._recv(type, state)
  }

  _oncontrolsession (type, state) {
    switch (type) {
      case 0:
        this._onbatch(state)
        break

      case 1:
        // return the promise back up as this has sideeffects so we can batch reply
        return this._onopensession(state)

      case 2:
        this._onrejectsession(state)
        break

      case 3:
        this._onclosesession(state)
        break
    }

    return null
  }

  _bufferMessage (r, type, { buffer, start, end }) {
    const state = { buffer, start, end } // copy
    r.pending.push({ type, state })
    this._buffered += byteSize(state)
    this._pauseMaybe()
  }

  _pauseMaybe () {
    if (this._paused === true || this._buffered <= MAX_BUFFERED) return
    this._paused = true
    this.stream.pause()
  }

  _resumeMaybe () {
    if (this._paused === false || this._buffered > MAX_BUFFERED) return
    this._paused = false
    this.stream.resume()
  }

  _onbatch (state) {
    const end = state.end
    let remoteId = c.uint.decode(state)

    let waiting = null

    while (state.end > state.start) {
      const len = c.uint.decode(state)
      if (len === 0) {
        remoteId = c.uint.decode(state)
        continue
      }
      state.end = state.start + len
      // if batch contains more than one message, cork it so we reply back with a batch
      if (end !== state.end && waiting === null) {
        waiting = []
        this.cork()
      }
      const p = this._decode(remoteId, state)
      if (waiting !== null && p !== null) waiting.push(p)
      state.start = state.end
      state.end = end
    }

    if (waiting !== null) {
      // the waiting promises are not allowed to throw but we destroy the stream in case we are wrong
      Promise.all(waiting).then(this._uncorkBound, this._safeDestroyBound)
    }
  }

  _onopensession (state) {
    const remoteId = c.uint.decode(state)
    const protocol = c.string.decode(state)
    const id = unslab(c.buffer.decode(state))

    // remote tried to open the control session - auto reject for now
    // as we can use as an explicit control protocol declaration if we need to
    if (remoteId === 0) {
      this._rejectSession(0)
      return null
    }

    const rid = remoteId - 1
    const info = this._get(protocol, id)

    // allow the remote to grow the ids by one
    if (this._remote.length === rid) {
      this._remote.push(null)
    }

    if (rid >= this._remote.length || this._remote[rid] !== null) {
      throw new Error('Invalid open message')
    }

    if (info.outgoing.length > 0) {
      const localId = info.outgoing.shift()
      const session = this._local[localId - 1]

      if (session === null) { // we already closed the channel - ignore
        this._free.push(localId - 1)
        return null
      }

      this._remote[rid] = { state, pending: null, session: null }

      session._remoteId = remoteId
      session._fullyOpen()
      return null
    }

    const copyState = { buffer: state.buffer, start: state.start, end: state.end }
    this._remote[rid] = { state: copyState, pending: [], session: null }

    if (++this._remoteBacklog > MAX_BACKLOG) {
      throw new Error('Remote exceeded backlog')
    }

    info.pairing++
    info.incoming.push(remoteId)

    return this._requestSession(protocol, id, info).catch(this._safeDestroyBound)
  }

  _onrejectsession (state) {
    const localId = c.uint.decode(state)

    // TODO: can be done smarter...
    for (const info of this._infos.values()) {
      const i = info.outgoing.indexOf(localId)
      if (i === -1) continue

      info.outgoing.splice(i, 1)

      const session = this._local[localId - 1]

      this._free.push(localId - 1)
      if (session !== null) session._close(true)

      this._gc(info)
      return
    }

    throw new Error('Invalid reject message')
  }

  _onclosesession (state) {
    const remoteId = c.uint.decode(state)

    if (remoteId === 0) return // ignore

    const rid = remoteId - 1
    const r = rid < this._remote.length ? this._remote[rid] : null

    if (r === null) return

    if (r.session !== null) r.session._close(true)
  }

  async _requestSession (protocol, id, info) {
    const notify = this._notify.get(toKey(protocol, id)) || this._notify.get(toKey(protocol, null))

    if (notify) await notify(id)

    if (--info.pairing > 0) return

    while (info.incoming.length > 0) {
      this._rejectSession(info, info.incoming.shift())
    }

    this._gc(info)
  }

  _rejectSession (info, remoteId) {
    if (remoteId > 0) {
      const r = this._remote[remoteId - 1]

      if (r.pending !== null) {
        for (let i = 0; i < r.pending.length; i++) {
          this._buffered -= byteSize(r.pending[i].state)
        }
      }

      this._remote[remoteId - 1] = null
      this._resumeMaybe()
    }

    const state = { buffer: null, start: 2, end: 2 }

    c.uint.preencode(state, remoteId)

    state.buffer = this._alloc(state.end)

    state.buffer[0] = 0
    state.buffer[1] = 2
    c.uint.encode(state, remoteId)

    this._write0(state.buffer)
  }

  _write0 (buffer) {
    if (this._batch !== null) {
      this._pushBatch(0, buffer.subarray(1))
      return
    }

    this.drained = this.stream.write(buffer)
  }

  destroy (err) {
    this.stream.destroy(err)
  }

  _safeDestroy (err) {
    safetyCatch(err)
    this.stream.destroy(err)
  }

  _shutdown () {
    for (const s of this._local) {
      if (s !== null) s._close(true)
    }
  }
}

function noop () {}

function toKey (protocol, id) {
  return protocol + '##' + (id ? b4a.toString(id, 'hex') : '')
}

function byteSize (state) {
  return 512 + (state.end - state.start)
}

function isPromise (p) {
  return !!(p && typeof p.then === 'function')
}

function encodingLength (enc, val) {
  const state = { buffer: null, start: 0, end: 0 }
  enc.preencode(state, val)
  return state.end
}
