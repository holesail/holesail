# hypertrace

Add tracing and insights to classes. One of the goals of the module is that there is close to zero overhead when tracing is not enabled. This is achieved by not enabling tracing on objects created before tracing was enabled.

Similarly if caching is enabled then there is almost zero overhead while tracing.

There is support for Prometheus/Grafana through [hypertrace-prometheus](https://github.com/holepunchto/hypertrace-prometheus) to get better visual insights into an application's behavior.

## Installation

```
$ npm i hypertrace
```

## Usage / instrumentation

First create tracers in the classes where insights are needed

`some-module.js`
``` js
import { createTracer } from 'hypertrace'

export default class SomeModule {
  constructor () {
    this.tracer = createTracer(this, {
      props: {
        some: 'property'
      }
    })
  }

  createChild () {
    const child = new Child(this.tracer)
    return child
  }
}

class Child {
  constructor (parentTracer) {
    this.tracer = createTracer(this, {
      parent: parentTracer,
      props: {
        another: 'value'
      }
    })
  }

  foo (val) {
    this.tracer.trace({ val })
  }
}
```

Then add `.setTraceFunction()` when traces are needed. It's important that this happens **before** classes that use Hypertrace are instantiated. Otherwise the tracer will not be enabled for those objects.

`app.js`
``` js
import SomeModule from 'some-module'
import { setTraceFunction } from 'hypertrace'

// Log everytime .trace() is being called.
// Important to call `setTraceFunction` BEFORE objects are instantiated and calls `createTracer`
setTraceFunction(({ id, caller, object, parentObject }) => {
  console.log({
    id,
    caller,
    object,
    parentObject,
  })
})

const mod = new SomeModule() // Inherently calls `createTracer`
const child = mod.createChild()
child.foo(123)

/*
  Prints out:
{
  id: null,
  caller: {
    functionName: 'foo',
    filename: '/Users/.../app.js',
    line: 28, // The line where .trace() is being called
    column: 19,
    props: { val: 123 }
  },
  object: {
    className: 'Child',
    id: 1,
    props: { another: 'value' },
    ctx: Child { tracer: [Hypertrace] }
  },
  parentObject: {
    className: 'SomeModule',
    id: 1,
    props: { some: 'property' },
    ctx: SomeModule { tracer: [Hypertrace] }
  }
}
*/
```

## Methods

### createTracer(context, { parent, props })

Create a new Hypertrace instance inside a class. Often used in the `constructor`.

_If_ this is called before `setTraceFunction` then it will return a cummy class. This means that there will be close to zero overhead when tracing is not needed.

- **props**: (optional) Some properties that are passed along to the trace function
- **parent**: (optional) A parent hypertrace instance to allow deeper understanding of structure. This is pased to the trace function.

``` js
class SomeClass {
  constructor() {
    this.tracer = createTracer(this)
  }
}
```

#### .trace([id], [props])

If the trace function has been set with `setTraceFunction`, then it is called.

Note: If the trace function has not been set, there is no overhead in calling this.

Note: If `.trace()` is called _very_ often then there can be some measurable overhead if the trace function has been set. To avoid this overhead pass `id`, which then always calls the trace function with the same cached parameters. `props` will always be passed.

- **id**: (optional) A id (string) that can be used to significantly speed up tracing, by caching returned resuls.
- **props**: (optional) A map of properties that's passed to the trace function

``` js
class SomeClass {
  constructor() {
    this.tracer = new Hypertrace(this)
  }
  fn (some, val) {
    this.tracer.trace({ some, val })
  }
}
```

#### .setParent([parentTracer])

Sets the parent tracer of this one. This means that subsequent calls to `.trace()` will have the new `parentObject`.

If `parentTracer` is null, then the current parent is removed and subsequent calls to `.trace()` will not have a `parentObject`.

#### .enabled

A flag that says if the tracer is enabled for this Hypertrace. This is `true` if a trace function was set before initiating, and `false` if not.


#### .objectId

The `objectId` of this instance.

#### .className

The `className` of this instance.

#### .props

The `props` passed when this instance was created.

#### .ctx

The `ctx` of this instance. If `createTracer(this)` then `ctx = this`.

### setTraceFunction(({ object, parentObject, caller }) => { ... })

Set a global trace function that is invoked everytime `.trace()` is being called.

**Important**: Tracing is only enabled for objects created after `setTraceFunction` is called.

- **object**: Contains `ctx`, `className`, `id`, and `props`
- **parentObject**: If hypertrace was initiated with `parent` then it contains `ctx`, `className`, `id`, and `props`
- **caller**: Contains `functionName`, `filename`, `line`, `column`, and `props

### clearTraceFunction()

Remove the global trace function. Calls to `createTracer` after this will return a dummy object to reduce runtime overhead.
