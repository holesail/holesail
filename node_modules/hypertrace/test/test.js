const test = require('brittle')
const { setTraceFunction, clearTraceFunction, createTracer } = require('../')
const SomeModule = require('./fixtures/SomeModule')

function teardown () {
  clearTraceFunction()
}

test('Caller is set for trace function', t => {
  t.teardown(teardown)
  t.plan(4)

  setTraceFunction(({ caller }) => {
    t.is(caller.functionName, 'callTrace')
    t.ok(caller.filename.endsWith('/test/fixtures/SomeModule.js'))
    t.is(caller.line, 9)
    t.is(caller.column, 17)
  })

  const someModule = new SomeModule()
  someModule.callTrace()
})

test('Props are passed as caller.props', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ caller }) => {
    t.alike(caller.props, someProps)
  })

  const someModule = new SomeModule()
  const someProps = {
    someProperty: Buffer.from('some value')
  }
  someModule.callTrace(someProps)
})

test('Context needs to be given', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => { }) // Need to set this, unless createTracer() hits NoTracingClass
  t.exception(() => createTracer(/* no context here */))
})

test('ObjectId remains the same in an objects lifetime', t => {
  t.teardown(teardown)
  t.plan(2)

  setTraceFunction(({ object }) => {
    if (!firstObjectId) {
      firstObjectId = object.id
    } else {
      t.is(object.id, firstObjectId)
    }
  })

  const someModule = new SomeModule()
  let firstObjectId

  someModule.callTrace()
  someModule.callTrace()
  someModule.callTrace()
})

test('ObjectId for a class starts at 1', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ object }) => {
    t.is(object.id, 1)
  })

  class SomeClass {
    constructor () {
      this.tracer = createTracer(this)
    }

    fun () {
      this.tracer.trace()
    }
  }
  const obj = new SomeClass()

  obj.fun()
})

test('ObjectId increases by one for same class', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ object }) => {
    if (!firstObjectId) {
      firstObjectId = object.id
    } else {
      t.is(object.id, firstObjectId + 1)
    }
  })

  let firstObjectId
  const someModule1 = new SomeModule()
  const someModule2 = new SomeModule()

  someModule1.callTrace()
  someModule2.callTrace()
})

test('Object is able to read its own objectId', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ object }) => {
    objectIdFromTracing = object.id
  })

  let objectIdFromTracing
  const someModule = new SomeModule()
  someModule.callTrace()
  const objectIdFromObject = someModule.getTracerObjectId() // The function returns this.tracing.getObjectId()

  t.is(objectIdFromObject, objectIdFromTracing)
})

test('When parent initiated with props, read them in parentObject.props', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ parentObject }) => {
    t.alike(parentObject.props, someProps)
  })

  class Parent {
    constructor () {
      this.tracer = createTracer(this, { props: someProps })
    }

    createChild () {
      return new Child(this.tracer)
    }
  }

  class Child {
    constructor (parentTracer) {
      this.tracer = createTracer(this, { parent: parentTracer })
    }

    callTrace () {
      this.tracer.trace()
    }
  }

  const someProps = { some: 'value' }
  const parent = new Parent()
  const child = parent.createChild()
  child.callTrace()
})

test('Hypertrace nitiated with props are added as object.props', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ object }) => {
    t.alike(object.props, someProps)
  })

  class SomeClass {
    constructor () {
      this.tracer = createTracer(this, { props: someProps })
    }

    fun () {
      this.tracer.trace()
    }
  }

  const someProps = {
    someProp: 'someValue'
  }
  const obj = new SomeClass()

  obj.fun()
})

test('Not settings props leaves it underfned', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ object }) => {
    t.absent(object.props)
  })

  const someModule = new SomeModule()

  someModule.callTrace()
})

test('Instantiating hypertrace without a parent hypertrace, sets parentObject to undefined', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ parentObject }) => {
    t.absent(parentObject)
  })

  class SomeClass {
    constructor () {
      this.tracer = createTracer(this)
    }

    callTrace () {
      this.tracer.trace()
    }
  }
  const obj = new SomeClass()

  obj.callTrace()
})

test('Instantiating hypertrace with a parent hypertrace, sets parentObject', t => {
  t.teardown(teardown)
  t.plan(5)

  setTraceFunction(({ object, parentObject, caller }) => {
    t.is(object.className, 'SomeChild')
    t.is(object.id, 1)
    t.is(parentObject.className, 'SomeParent')
    t.is(parentObject.id, 1)
    t.is(caller.functionName, 'callTrace')
  })

  class SomeParent {
    constructor () {
      this.tracer = createTracer(this)
    }

    createChild () {
      const child = new SomeChild(this)
      return child
    }
  }

  class SomeChild {
    constructor (parent) {
      this.tracer = createTracer(this, {
        parent: parent.tracer
      })
    }

    callTrace () {
      this.tracer.trace()
    }
  }

  const core = new SomeParent()
  const child = core.createChild()

  child.callTrace()
})

test('setTraceFunction before initiating class means that it is called', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => {
    t.pass()
  })

  const mod = new SomeModule()
  mod.callTrace()
})

test('setTraceFunction after initiating class means that it is not called', t => {
  t.teardown(teardown)
  t.plan(0)

  const mod = new SomeModule()
  mod.callTrace()

  setTraceFunction(() => {
    t.fail()
  })
})

test('If setTraceFunction is not set before initiating, then Hypertrace.enabled = false', t => {
  t.teardown(teardown)
  t.plan(1)

  class SomeClass {
    constructor () {
      this.tracer = createTracer(this)
    }

    getEnabledStatus () {
      return this.tracer.enabled
    }
  }

  const obj = new SomeClass()
  t.is(obj.getEnabledStatus(), false)
})

test('If setTraceFunction is set before intiating, then Hypertrace.enabled = true', t => {
  t.teardown(teardown)
  t.plan(1)

  class SomeClass {
    constructor () {
      this.tracer = createTracer(this)
    }

    getEnabledStatus () {
      return this.tracer.enabled
    }
  }

  setTraceFunction(() => { })
  const obj = new SomeClass()
  t.is(obj.getEnabledStatus(), true)
})

test('.ctx is set on tracer', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => { }) // Has to be set, otherwise ctx is null
  const someModule = new SomeModule()
  t.is(someModule.getTracerCtx(), someModule)
})

test('.className is set on tracer', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => { }) // Has to be set, otherwise ctx is null
  const someModule = new SomeModule()
  t.is(someModule.getTracerClassName(), 'SomeModule')
})

test('.objectId is set on tracer', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => { }) // Has to be set, otherwise ctx is null
  class SomeClass {
    constructor () {
      this.tracer = createTracer(this)
    }

    getTracerObjectId () {
      return this.tracer.objectId
    }
  }
  const obj = new SomeClass()
  t.is(obj.getTracerObjectId(), 1)
})

test('.props is set on tracer', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => { }) // Has to be set, otherwise ctx is null
  const someProps = { some: 'props' }
  const someModule = new SomeModule(someProps)
  t.alike(someModule.getTracerProps(), someProps)
})

test('ctx is passed in object', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ object }) => {
    t.is(object.ctx, someModule)
  })

  const someModule = new SomeModule()
  someModule.callTrace()
})

test('ctx is passed in parentObject', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ parentObject }) => {
    t.is(parentObject.ctx, parent)
  })

  class Parent {
    constructor () {
      this.tracer = createTracer(this)
    }

    createChild () {
      return new Child(this.tracer)
    }
  }

  class Child {
    constructor (parentTracer) {
      this.tracer = createTracer(this, { parent: parentTracer })
    }

    callTrace () {
      this.tracer.trace()
    }
  }

  const parent = new Parent()
  const child = parent.createChild()
  child.callTrace()
})

test('Using id speeds up trace calls', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => { })

  const callsCount = 50000
  const mod = new SomeModule()
  const start1 = Date.now()
  for (let i = 0; i < callsCount; i++) {
    mod.callTrace()
  }
  const timeWithoutCache = Date.now() - start1

  const start2 = Date.now()
  for (let i = 0; i < callsCount; i++) {
    mod.callTrace('someId')
  }
  const timeWithCache = Date.now() - start2

  t.ok(timeWithCache < timeWithoutCache, `Doing ${callsCount} calls. Without cache: ${timeWithoutCache}ms. With cache: ${timeWithCache}ms.`)
})

test('Using id together with opts', t => {
  t.teardown(teardown)
  t.plan(2)

  setTraceFunction(({ caller }) => {
    t.alike(caller.props, someProps)
  })

  const someProps = {
    some: 'value'
  }

  const mod = new SomeModule()
  mod.callTrace('someId', someProps)
  mod.callTrace('someId', someProps)
})

test('Using id together with opts, will not cache the passed props', t => {
  t.teardown(teardown)
  t.plan(3)

  let calls = 0
  setTraceFunction(({ caller }) => {
    calls += 1
    if (calls === 1) t.alike(caller.props, someProps1)
    if (calls === 2) t.alike(caller.props, someProps2)
    if (calls === 3) t.absent(caller.props)
  })

  const someProps1 = {
    some: 'val1'
  }
  const someProps2 = {
    another: 'val2'
  }

  const mod = new SomeModule()
  mod.callTrace('someId', someProps1)
  mod.callTrace('someId', someProps2)
  mod.callTrace('someId')
})

test('Using same id in different tracers does not pass same args', t => {
  t.teardown(teardown)
  t.plan(4)

  let calls = 0
  setTraceFunction(({ object }) => {
    calls += 1
    if (calls === 1) t.alike(object.props, someProps1)
    if (calls === 2) t.alike(object.props, someProps2)
    if (calls === 3) t.alike(object.props, someProps1)
    if (calls === 4) t.alike(object.props, someProps2)
  })

  const someProps1 = {
    some: 'val1'
  }
  const someProps2 = {
    another: 'val2'
  }
  const mod1 = new SomeModule(someProps1)
  mod1.callTrace('sameCacheId')
  const mod2 = new SomeModule(someProps2)
  mod2.callTrace('sameCachedId')

  mod1.callTrace('sameCachedId')

  mod2.callTrace('sameCachedId')
})

test('Passed opts map to trace function is not the same as the one passed to .trace()', t => {
  t.teardown(teardown)
  t.plan(4)

  setTraceFunction(({ object, caller }) => {
    t.is(object.props.some, 'val')
    t.is(caller.props.another, 'val')
    object.props.some = 'woah woah this is not val'
    caller.props.another = 'woah woah this is not val'
  })

  const someObjectProps = {
    some: 'val'
  }
  const someTraceProps = {
    another: 'val'
  }
  const mod = new SomeModule(someObjectProps)
  mod.callTrace(someTraceProps)
  t.is(someObjectProps.some, 'val')
  t.is(someTraceProps.another, 'val')
})

test('id is passed to trace function', t => {
  t.teardown(teardown)
  t.plan(2)

  let calls = 0
  setTraceFunction(({ id }) => {
    calls += 1
    if (calls === 1) t.is(id, 'someId')
    if (calls === 2) t.is(id, null)
  })

  const mod = new SomeModule()
  mod.callTrace('someId')
  mod.callTrace()
})

test('setParent changes the parent of the object', t => {
  t.teardown(teardown)
  t.plan(2)

  let calls = 0
  setTraceFunction(({ object, parentObject }) => {
    calls += 1
    if (calls === 1) t.alike(parentObject.props, originalProps)
    if (calls === 2) t.alike(parentObject.props, secondaryProps)
  })

  class OriginalParent {
    constructor () {
      this.tracer = createTracer(this, { props: originalProps })
    }

    createChild () {
      return new Child(this.tracer)
    }
  }

  class SecondaryParent {
    constructor () {
      this.tracer = createTracer(this, { props: secondaryProps })
    }
  }

  class Child {
    constructor (parentTracer) {
      this.tracer = createTracer(this, { parent: parentTracer })
    }

    callTrace () {
      this.tracer.trace()
    }
  }

  const originalProps = {
    some: 'val'
  }
  const secondaryProps = {
    anther: 'val'
  }

  const originalParent = new OriginalParent()
  const secondaryParent = new SecondaryParent()
  const child = originalParent.createChild()
  child.callTrace()
  child.tracer.setParent(secondaryParent.tracer)
  child.callTrace()
})

test('setParent with null, removed the parent', t => {
  t.teardown(teardown)
  t.plan(2)

  let calls = 0
  setTraceFunction(({ object, parentObject }) => {
    calls += 1
    if (calls === 1) t.alike(parentObject.props, someProps)
    if (calls === 2) t.absent(parentObject)
  })

  class Parent {
    constructor () {
      this.tracer = createTracer(this, { props: someProps })
    }

    createChild () {
      return new Child(this.tracer)
    }
  }

  class Child {
    constructor (parentTracer) {
      this.tracer = createTracer(this, { parent: parentTracer })
    }

    callTrace () {
      this.tracer.trace()
    }
  }

  const someProps = {
    some: 'val'
  }

  const parent = new Parent()
  const child = parent.createChild()
  child.callTrace()
  child.tracer.setParent()
  child.callTrace()
})

test('setParent called when not tracing does not throw', t => {
  t.teardown(teardown)
  t.plan(1)

  const mod1 = new SomeModule()
  const mod2 = new SomeModule()
  t.execution(() => {
    mod2.callSetParent(mod1.tracer)
  })
})
