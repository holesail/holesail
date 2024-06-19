const { createTracer } = require('../../')

module.exports = class SomeModule {
  constructor (props) {
    this.tracer = createTracer(this, { props })
  }

  callTrace (...args) {
    this.tracer.trace(...args)
  }

  callSetParent (parentTracer) {
    this.tracer.setParent(parentTracer)
  }

  getTracerObjectId () {
    return this.tracer.objectId
  }

  getTracerCtx () {
    return this.tracer.ctx
  }

  getTracerClassName () {
    return this.tracer.className
  }

  getTracerEnabled () {
    return this.tracer.enabled
  }

  getTracerProps () {
    return this.tracer.props
  }
}
