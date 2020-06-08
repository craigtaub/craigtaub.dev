---
path: "/under-the-hood-of-test-runners"
date: "2020-08-01"
title: "Under-the-hood of test runners (e.g Mocha)"
---

Test runners are a very important part to the modern JavaScript application. Without which we could not be able to run any tests at all. They are fairly straight forward to understand in terms of what they do, they run your tests and print output. However something which is not as straight forward is how they work and the mechanisms they utilise to enable the command-line interface that we are all so familiar with.

A video for this post can be found [here](https://www.youtube.com/watch?v=XefD5zuLAkU). This is part of my "under-the-hood of" series:

- [Source maps](https://craigtaub.dev/source-maps-from-top-to-bottom)
- [React hooks](https://craigtaub.dev/under-the-hood-of-react-hooks)
- [Web bundlers (e.g. Webpack)](https://craigtaub.dev/under-the-hood-of-web-bundlers)
- [Apollo](https://itnext.io/under-the-hood-of-apollo-6d8642066b28)
- [Type systems (e.g. TypeScript)](https://craigtaub.dev/under-the-hood-of-type-systems)

I have been a member of the MochaJS core team for a little over 2 years so I feel I have a good understanding how the Mocha test runner works. This post aims to shine a light on how the Mocha test runner works and the codebase design, by walking through a slimmed down version of the tool. The real one is many thousands of lines of code so I have created a slimmed down version which can be found [here](https://github.com/craigtaub/our-own-mocha). All of it has been taken from the real MochaJS codebase, however only the core functionality has been included. Hopefully this will help us focus on and learn about the individual aspects which are critical to its core functionality. It will be a mix of code snippets, links to mochas repository and links to my repository.

The article today will be broken down into 3 parts:

1. [Introduction to our test runner](#1-our-test-runner)
2. [Building our runner: Parsing phase](#2-parsing-phase)
3. [Building our runner: Execution phase](#3-execution-phase) (the bulk of the article)
   1. [Loading step](#1-loading)
   2. [Running step](#2-running)
   3. [Mocha.run](#mocharun)
   4. [Reporters](#reporters)
   5. [Runner.run](#runnerrun)
   6. [In-depth look at the code for `runner.run`](#in-depth-look-at-the-code-for-runnerrun)
   7. ["Running step" summary](#running-step-summary)

---

Before we move on here is some of the basic terminology for the core functionality of any test runner:

- `Test` - Functions with an assertion/s inside
- `Suite` - Collection of tests
- `Hook` - Functions run at specific times in a test runners lifecycle
- `Reporter` - Determines the presentation of the output
- `Interface` - The methods that will be use inside each test e.g. `describe` and `it` (also known as `UI`)
- `Runner` - A given run of a suite, tests, hooks, reporter etc (uses an instance of a Runnable)

---

# 1. Our test runner

Given that test runners can include a huge variation of functionality, not all of which is necessary for the basic job of the test runner, today we will be building our own test runner which includes:

- Tests
- Suites
- Hooks
- Interfaces
- Reporters

This means we will be ignoring all other features, for example option validation, timeout management, slow test flagging, pending states etc.

Our runner output will look like this.

<img src="/images/test-runner-screen.png" alt="test-runner-screenshot" width="350px">

- One test fails
- Two tests in different suites pass
- _Second suite_ logs all hooks

## Modules in MochaJS

It is necessary to understand the types of Modules that can be used in and are found in the MochaJS codebase, as we will be sticking to the same.

- MochaJS uses CJS module inside the core, so it does not support ESM natively yet.
- MochaJS accepts ESM for test files.

It is also worth noting that Mocha **does not have a transpilation step** (yet, plans are at work) so most of the code is ES5.

## Our runners basic breakdown

There are 3 parts to our runner

**1. The entities required for a test runner**

This includes everything from above i.e Tests, Suites, Hooks, Reporters, Interfaces, Runner and Runnable.

**2. The Parsing phase**

This is the first of 2 steps for the runner. The goal with this phase is to build a coherent CLI for the user.

MochaJS makes use of `yargs`. You can see the starting point in [lib/cli/cli.js](https://github.com/mochajs/mocha/blob/master/lib/cli/cli.js). As it is ES5 it uses prototypes so it can use ES5 class instances.

**3. Execution phase**

The final part of the runner relies on a Mocha instance to be handed to it from the parsing phase. This part creates an instance of a Runnable and executes everything from the suites and tests to the hooks and reporters.

---

# 2. Parsing phase

Here we create a `yars` instance, it includes the basics required to have an intuitive command-line interface (e.g. asking for `version` information or `help`). We attach a `commands` object (see details below).

I have included in comments the location of the code in the real Mocha codebase.

```javascript
// lib cli/cli.js main()
const argv = process.argv.slice(2)
// lib/cli/options loadOptions()
var args = yargsParser.detailed(argv).argv
args._ = Array.from(new Set(args._))

yargs()
  .scriptName("our_mocha")
  .command(commands.run)
  .fail((msg, err, yargs) => {
    yargs.showHelp()
    const message = msg || err.message
    console.error(`\nERROR: ${message}`)
    process.exit(1)
  })
  .help("help", "Show usage information & exit")
  .version("version", "Show version number & exit", "1.0")
  .epilog("Mocha Resources: ...")
  .config(args)
  .parse(args._)
```

Below details the `commands` object using a child `yargs` instance. It will set options and run validation checks (see methods `options()` and `check()`)

Finally if it passes all these it will build a new Mocha instance (see `new Mocha(argv)`) and hand it to next phase (`runMocha(mocha, argv)`)

```javascript
const builder = yargs => {
  // cli/run.js builder()
  return yargs
    .options({
      config: {
        config: true,
        description: "Path to config file",
      },
      reporter: {
        default: defaults.reporter,
        description: "Specify reporter to use",
        requiresArg: true,
      },
      ui: {
        default: defaults.ui,
        description: "Specify user interface",
        requiresArg: true,
      },
    })
    .check(argv => {
      // lib/cli/run-helpers.js handleRequires
      // load --requires first, because it can impact "plugin" validation

      // lib/cli/run-helpers.js validatePlugin
      // validate `--reporter` and `--ui`.  Ensures there's only one, and asserts that it actually exists
      // Checks keys on Mocha.reporters + Mocha.interfaces

      return true
    })
}
const handler = async function(argv) {
  const mocha = new Mocha(argv)

  try {
    // NEXT PHASE
    await runMocha(mocha, argv)
  } catch (err) {
    console.error("\n" + (err.stack || `Error: ${err.message || err}`))
    process.exit(1)
  }
}
const commands = {
  run: {
    command: ["$0 [spec..]", "inspect"],
    describe: "Run tests with Our-Mocha",
    builder,
    handler,
  },
}
```

My code for the parser can be found [here](https://github.com/craigtaub/our-own-mocha/blob/master/runner/parsing/index.js).

## Building the Mocha instance

Let us look at what creating a `new Mocha` instance does by examining its constructor plus the `ui` and `reporter` instance methods.

```javascript
function Mocha(options) {
  this.files = []
  this.options = options

  // lib/context.js. empty context
  function Context() {}
  // root suite
  this.suite = new Suite("", new Context(), true)

  this.ui(options.ui).reporter(options.reporter)
}
Mocha.prototype.ui = function(ui) {
  var bindInterface
  ui = ui || "bdd"
  bindInterface = Mocha.interfaces[ui]
  bindInterface(this.suite)

  return this
}
Mocha.prototype.reporter = function(reporter) {
  const builtinReporters = Mocha.reporters
  reporter = reporter || "spec"
  var _reporter
  // Try to load a built-in reporter.
  _reporter = builtinReporters[reporter]
  // Try to load reporters from process.cwd() and node_modules

  this._reporter = _reporter
  return this
}
Mocha.reporters = {
  base: Base, // imported from elsewhere
  spec: Spec,
}
Mocha.interfaces = {
  common: function() {},
  bdd: function() {},
}
```

So above:

- _Constructor_: Creates instance of our Root Suite and attaches to `this.suite` (see `this.suite = new Suite`). `Suite` inherits pub/sub from `EventEmitter`.
- _ui_ method: Based on the interface we bind events, which attach interface methods, onto our suite context `this.suite`. See details on [bindInterface](#how-does-the-interface-work-with-our-mocha-instance) below.
- _reporter_ method: Creates instance of a Reporter and attaches to `this._reporter` (see `this._reporter = _reporter`). An example of a reporter is the `Spec` function (see `Mocha.reporters.spec`)

## How does the Interface work with our Mocha instance?

For our BDD interface it is set below, called from the `ui()` method ([here](https://github.com/craigtaub/our-own-mocha/blob/master/runner/mocha/index.js#L66)) and initially the [constructor](https://github.com/craigtaub/our-own-mocha/blob/master/runner/mocha/index.js#L60).

```javascript
bdd: function bddInterface(suite) {
  var suites = [suite]

  suite.on(EVENT_FILE_PRE_REQUIRE, function(context, file, mocha) {
    var common = Mocha.interfaces.common(suites, context, mocha)

    context.before = common.before
    context.after = common.after
    context.beforeEach = common.beforeEach
    context.afterEach = common.afterEach

    context.describe = function(title, fn) {
      return common.suite.create({
        title: title,
        file: file,
        fn: fn,
      })
    }

    context.it = function(title, fn) {
      var suite = suites[0]
      var test = new Test(title, fn)
      test.file = file
      suite.addTest(test)
      return test
    }
  })
}
```

Let us walk-through whats is going on.

Each time the event is fired (inside the execution phase coming later) the listener callback runs. The callback is given the params `context`, `file` and our `mocha` instance..

So based on an event (i.e. `on("EVENT_FILE_PRE_REQUIRE")` ) it attaches the interface methods, see `context.after = ...`, `context.describe = ...`, `context.it = ....`. Many of which come from a utility object called `common`.

Here the `describe()` method creates and returns a new `Suite` via `suite.create()`. The `it()` method creates and returns a new `Test` via `new Test()`.

So thats it for the parsing phase, we now have our Mocha instance which has the reporter and the suite with the interface getting attached each time.

---

# 3. Execution phase

Now we have everything that we need to execute our test runner. We will be loading files and then running it.

## 1. Loading

Our parser calls `runMocha` inside the `handler()` (in [parsing phase](#2-parsing-phase) above).

```javascript
async function runMocha(mocha, options) {
  const { spec = [] } = options

  // if options.watch watchRun()

  // singleRun
  // collectFiles and lookupFiles here
  mocha.files = spec
  await mocha.loadFilesAsync()
  return mocha.run(exitMochaLater)
}
```

We start by building an array of all the files to run. We pass them from the `spec` array.

We have a simplified version of this, but in the real mocha codebase there are many checks done against the spec items to check for globs, files and directories (see [lib/cli/collect-files.js](https://github.com/mochajs/mocha/blob/master/lib/cli/collect-files.js#L36) and [lookupFiles](https://github.com/mochajs/mocha/blob/master/lib/utils.js#L499)).

Next we call `loadFilesAsync`. This loads the ESM and CJS files asynchronously, emits the `"EVENT_FILE_PRE_REQUIRE"` event and then runs the root suite.

```javascript
Mocha.prototype.loadFilesAsync = async function() {
  var self = this
  var suite = this.suite

  for (let file of this.files) {
    // preload
    suite.emit(Suite.constants.EVENT_FILE_PRE_REQUIRE, global, file, self)
    // load
    file = path.resolve(file)
    const result = await require(file)
    // postload events
  }
}
```

The `"EVENT_FILE_PRE_REQUIRE"` event had the listener set in our `bddInterface` function above ([here](#how-does-the-interface-work-with-our-mocha-instance)). So it is now that the interface methods are added to the suite context.

It is under [esm-utils.js](https://github.com/mochajs/mocha/blob/master/lib/esm-utils.js) in the real mocha codebase.

Finally it runs the `mocha.run()` which moves us onto the running step.

---

## 2. Running

This phase is split into the following sections:

1.  [Mocha.run](#mocharun)
1.  [Reporters](#reporters)
1.  [Runner.run](#runnerrun)
1.  [In-depth look at the code for `runner.run`](#in-depth-look-at-the-code-for-runnerrun)
1.  ["Running step" summary](#running-step-summary)

### mocha.run

```javascript
Mocha.prototype.run = function(fn) {
  var suite = this.suite
  var options = this.options
  options.files = this.files
  var runner = new Runner(suite, options.delay)
  createStatsCollector(runner)
  var reporter = new this._reporter(runner, options)

  const noop = () => ""
  function done(failures) {
    fn = fn || noop
    if (reporter.done) {
      reporter.done(failures, fn)
    } else {
      fn(failures)
    }
  }

  return runner.run(done)
}
```

Lets walk-through what it does

Create instance of a `Runner` (file [here](https://github.com/craigtaub/our-own-mocha/blob/master/runner/mocha/runner.js)) and add stats collecting.

Similarly to the `Suite,` the `Runner` inherits from `EventEmitter`. This is for the publish and subscribe events functionality that Mocha relies on.

```javascript
// lib/stats-collector.js
function createStatsCollector(runner) {
  var stats = {
    suites: 0,
    tests: 0,
    passes: 0,
    pending: 0,
    failures: 0,
  }

  if (!runner) {
    throw new TypeError("Missing runner argument")
  }

  runner.stats = stats

  runner.once(EVENT_RUN_BEGIN, function() {
    stats.start = new Date()
  })
  runner.on(EVENT_SUITE_BEGIN, function(suite) {
    suite.root || stats.suites++
  })
  runner.on(EVENT_TEST_PASS, function() {
    stats.passes++
  })
  runner.on(EVENT_TEST_FAIL, function() {
    stats.failures++
  })
  runner.on(EVENT_TEST_END, function() {
    stats.tests++
  })
  runner.once(EVENT_RUN_END, function() {
    stats.end = new Date()
    stats.duration = stats.end - stats.start
  })
}
```

Here is our stats collector. On pass/fail/end events increment pass/fail/end on the `runner.stats` object. In the real mocha codebase found [lib/stats-collector.js](https://github.com/mochajs/mocha/blob/master/lib/stats-collector.js).

Back to our `Mocha.prototype.run`. Next we create an instance of a Reporter using the Runner (see `new this._reporter(runner, options)`)

### Reporters

Inside the reporter we add spec-specific listeners onto the runner events. For example on `EVENT_RUN_END` even will run `reporter.epilogue()`.

See below for a snippet from the spec reporter which includes events for

- Run begin
- Test pass
- Test fail
- Run end

```javascript
function Spec(runner, options) {
  Base.call(this, runner, options)

  runner.on(EVENT_RUN_BEGIN, function() {
    Base.consoleLog()
  })

  // more ....

  runner.on(EVENT_TEST_PASS, function(test) {
    var fmt =
      indent() +
      color("checkmark", "  " + Base.symbols.ok) +
      color("pass", " %s") +
      color(test.speed, " (%dms)")
    Base.consoleLog(fmt, test.title, test.duration)
  })

  runner.on(EVENT_TEST_FAIL, function(test) {
    Base.consoleLog(indent() + color("fail", "  %d) %s"), ++n, test.title)
  })

  runner.once(EVENT_RUN_END, self.epilogue.bind(self))
}
```

So essentially as the runner is running our tests, the `Spec` reporter is printing output.

Below is the `epilogue` from the `Base` reporter. It processes the details on `this.stats` and once the tests are finished, outputs a final statement detailing the summary of the run.

```javascript
Base.prototype.epilogue = function() {
  var stats = this.stats

  Base.consoleLog()

  // passes
  var fmt =
    color("bright pass", " ") +
    color("green", " %d passing") +
    color("light", " (%s)")

  Base.consoleLog(fmt, stats.passes || 0, milliseconds(stats.duration))

  // failures
  if (stats.failures) {
    fmt = color("fail", "  %d failing")

    Base.consoleLog(fmt, stats.failures)

    Base.list(this.failures)
  }
}
```

See the spec and base [files](https://github.com/craigtaub/our-own-mocha/blob/master/runner/mocha/reporters/spec.js) for more.

Finally our _mocha.run_ triggers `return runner.run(done)`.

### runner.run

```javascript
Runner.prototype.run = function(fn) {
  var self = this
  var rootSuite = this.suite
  fn = fn || function() {}
  function start() {
    self.started = true
    self.emit(Runner.constants.EVENT_RUN_BEGIN)

    self.runSuite(rootSuite, function() {
      self.emit(Runner.constants.EVENT_RUN_END)
    })
  }
  // callback
  this.on(Runner.constants.EVENT_RUN_END, function() {
    fn(self.failures)
  })

  start()

  return this
}
```

So lets walk-through `runner.run`

- Creates a listener for `EVENT_RUN_END` events
  - It will run the `fn` callback with failure details
- Emits an `EVENT_RUN_BEGIN` event
- Executes each suite on Root suite, via `runSuite`
  - This is very important; _for each suite it will run all tests and hooks_
  - Once that is finished it emits an`EVENT_RUN_END` event

So not that crazy but we need to dig deeper into `runSuite`.

This is where all the suite, tests and hook are executed. To summarise how it works, starting with the Root Suite it:

1. Executes all before hooks for the suite
2. Then runs all tests for the suite
3. Then runs all after hooks for the suite
4. The moves onto the next suite.

If you are interested in more details, the next section looks at the code necessary to run the above. Alternatively skip to the [summary section](#running-step-summary) after this to see an overview.

---

### In-depth look at the code for `runner.run`.

The total size of all the code required is quite large, so in an attempt to make it easier to follow the mechanics below I have included most of the required code for them.

The `Runner` methods we will cover are:

- `runSuite`
- `hook`
- `runTests`
- `runTest`
- `hooks`

I will explain each one as we go along by doing both code comments and text outside the function. Use whichever you prefer.

#### Runner.runSuite

```javascript
Runner.prototype.runSuite = function (suite, fn) {
  this.emit(EVENT_SUITE_BEGIN, (this.suite = suite))

  function done(errSuite) {
    // 6. run all afterAll hooks
    self.hook(HOOK_TYPE_AFTER_ALL, () => {
      self.emit(EVENT_SUITE_END, suite);
      fn(errSuite);
    });
  }

  function next() {
    curr = suite.suites[i++]; // grab next suite
    // 5. no suites left, done
    if (!curr) done();
    // 4. call suite
    runSuite(curr, next);
  }

  // 1. run all beforeAll hooks
  hook(HOOK_TYPE_BEFORE_ALL, () => {
    // 2. run tests + callback once complete
    runTests(suite, next)
  }
}
```

1. emit `EVENT_SUITE_BEGIN`
2. trigger the `beforeAll` hooks with a callback.

##### `hook` callback (after `beforeAll`)

- trigger `runTests` handing `suite` and `next` callback.

##### `next` function

- grab the next suite in the suites array
- if no suite is left trigger `done`
- else call itself via `runSuite` with the next suite.

##### `done` function

- run all `afterAll` hooks
- emit `EVENT_SUITE_END` event

#### Runner.hook

```javascript
Runner.prototype.hook = function (name, fn) {
  // 1. for current suite, get hooks with name x
  var hooks = this.suite.getHooks(name);

  function next(i){
    // 3. grab current hook
    var hook = hooks[i];
    // 4. executed all hooks under name x for suite
    if (!hook) fn()

    // set hooks test context
    hook.ctx.currentTest = ...

    // 5. execute hook.
    hook.run(() => {
      // 6. end of hook trigger next hook
      next(++i)
    });
  }

  // 2. trigger start of hooks
  next(0);
}
```

1. Grab all hooks with the name given
2. trigger `next` callback with hook index

##### `next` function

- using index grab the current hook
- if no hook call `fn`
- else set test context
- lastly execute the hook (`hook.run`) with a callback

##### `hook.run` method

This comes from the `Runnable.run` method below as the hooks inherit `Runnable`.

Call the function with the current context.

```javascript
Runnable.run(fn) {
  var ctx = this.ctx;
  fn.call(ctx);
}
```

##### `run` callback

- increment the hook index and call `next` again (triggering the next hook under the given name)

#### Runner.runTests

```javascript
Runner.prototype.runTests = function(callback) {
  function next() {
    // grab next test
    test = tests.shift()
    // no tests left, run callback running next suite
    if (!test) callback()
    // run beforeEach hooks
    hooks(HOOK_TYPE_BEFORE_EACH, () => {
      runTest(err => {
        if (err) {
          // test failure
          this.emit(EVENT_TEST_FAIL, test, err)
          self.emit(EVENT_TEST_END, test)
          // run after each hook
          return hooks(HOOK_TYPE_AFTER_EACH, next)
        }
        // test pass
        self.emit(EVENT_TEST_PASS, test)
        self.emit(EVENT_TEST_END, test)
        // run after each hook
        hooks(HOOK_TYPE_AFTER_EACH, next)
      })
    })
  }
  // run next test
  next()
}
```

- trigger next callback

##### `next` function

- grab the next test
- if no tests are left trigger `callback`
- else run `beforeEach` hooks

##### `hooks` callback

- trigger `runTest`

##### `runTest` callback

- if there is a test failure emit `EVENT_TEST_FAIL` event
- else emit `EVENT_TEST_PASS` event
- for both branches emit the `EVENT_TEST_END` event and run `afterEach` hook

#### Runner.runTest

```javascript
Runner.prototype.runTest = function(fn) {
  var self = this
  var test = this.test

  if (!test) return

  try {
    // 1. run the test
    test.run(fn)
  } catch (err) {
    fn(err)
  }
}
```

- early return if no test available
- run the test via `test.run`
- handle test errors

#### Runner.hooks

```javascript
Runner.prototype.hooks = function(name, callback) {
  function next(suite) {
    if (!suite) callback()
    hook(name, () => {
      next(suites.pop()) // run hooks for next suite
    })
  }
  next()
}
```

- call the next function

##### `next` function

- if there are no suites left to run trigger the `callback`
- trigger the hook for the given name
- after that run hooks for the next suite

---

### "Running step" summary

So essentially the core flow involved in the runner mentioned above is:

1. The Runner

   - Attaches event listeners
   - Updates `stats` property
   - Triggers the Root suite

2. The Suite

   - Executes the `beforeAll` hooks
   - Begins execution of the tests
   - Executes the `afterAll` hooks
   - Executes the next suite

3. The Tests

   - Executes the `beforeEach` hooks,
   - Executes the tests
   - Emits the test pass, fail and end events
   - Handle any unexpected failures
   - Executes the `afterEach` hooks

4. The Hooks

   - Executes all the hooks under the given name

5. The Reporter

   - Attaches event listeners
   - Processes the `stats`
   - Logs output to terminal/browser etc.

---

# Thats it

So there you have it, the Mocha test runner broken down from the parsing to the execution.

Thanks so much for reading or watching. I hope you have found this article useful or at least interesting in some ways. You can find the repository for all this code [here](https://github.com/craigtaub/our-own-mocha).

Thanks, Craig 😃
