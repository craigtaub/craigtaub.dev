---
path: "/under-the-hood-of-vscode-auto-formatters"
date: "2020-07-02"
title: "Under-the-hood of VSCode auto formatters (e.g Prettier)"
---

VSCode has become a staple for many developers local environment. One of the reasons is the powerful extensions which can be run from within the IDE itself, from type checking to code auto formatting. Here we will take a look at an overview of VSCode and then dig into how the auto formatting works. The final task will be to build a small version of Prettier (or eslint --fix) which can run as a VSCode extension. The goal is to understand the mechanics at work inside this kind of extension and some key differences with other types of extensions.

This is part of my ["under-the-hood of" series](/introducing-my-under-the-hood-of-series):

- [Web bundlers (e.g. Webpack)](/under-the-hood-of-web-bundlers)
- [Type systems (e.g. TypeScript)](/under-the-hood-of-type-systems)
- [Test runners (e.g. Mocha)](/under-the-hood-of-test-runners)
- [Source maps](/source-maps-from-top-to-bottom)
- [React hooks](/under-the-hood-of-react-hooks)
- [Apollo](https://itnext.io/under-the-hood-of-apollo-6d8642066b28)

A video for this post can be found [here](https://www.youtube.com/watch?v=tmV_m8ZRLn0). A part of my ["under-the-hood of"](https://www.youtube.com/channel/UCYi23MnKBKn0yLZKBrz5Bfw) video series.

The article today will be broken down into 3 parts:

1. [Electron](#1-electron)
2. [VSCode extensions](#2-vscode-extensions)
3. [Our own Prettier extension](#3-our-own-prettier-extension)

---

# 1. Electron

Under the hood VSCode is built with Electron. Electron is a software framework which allows for the development of desktop GUI applications using web technologies. It combines the Chromium rendering engine and the Node.js runtime. It was recently added to the [OpenJS Foundation](https://openjsf.org/projects/).

There are 2 types of processes inside Electron

1. Main process

   - only 1 run at a time
   - job to handle all the _Renderers_

2. Renderer process

   - many running at once
   - represents a page with UI
   - job to run code

A basic example of creating a new node process (renderer) is a below.

```javascript
let { fork } = require("child_process")
let serverProcess = fork(__dirname + "/server.js")
```

Messages are sent across processes via IPC (inter-process communication), this enables rendrer-to-renderer communication, bypassing the main process. The GUI's are Chromium web pages.

---

# 2. VSCode extensions

VSCode has extensions which introduce more advanced functionality. As it is built with Electron it must conform to the process rules.

In VSCode all extensions run in a single _Renderer process_ called the "extension host process" (process name `shared-process`, in task manager they are under `Code helper (renderer)`).

There seem to be 2 main types of VSCode extensions:

1. The extension host proccess does all the work
2. The extension host process runs a "client" whose job is to spawn a "server" _Renderer process_, which will do most of the heavy lifting. The server communicates with the client.

   - this is common for a Language Server
   - it is worth noting that only the "extension host process" can update the GUI.

   > You can see which process is running what task via the VSCode Process Explorer (CMD Palette "_Developer: Open Process Explorer_")

## Type 2 - Language Servers

Language Servers are background tasks spawned by an extension for a specific purpose.

TypeScript and Eslint are both examples of extensions which run Language Servers for their compilers. This is so the "server" can do the majority amount of the processing in the background, and only needs to relay messages (e.g. diagnostics) to the "client". They are often configured to re-run on save. This produces a more performant "client". In general it is good practice to run linters under a Language Server.

There are several strong pros of using Language Servers:

1. Persistent memory and caching - the server never dies so can maintain a cache in memory to perform faster compiles in future runs
2. Faster boot up times - the server is already running shrinking any boot-up wait time to practically 0.

Finally it is worth noting that VSCode comes with its own ["Language Server Protocol"](https://microsoft.github.io/language-server-protocol/) which makes the client/server communication easier. It is a JSON-RPC standard between the development tool and the language server.

See example architecture below.

![VSCode extension architecture](/images/auto-formatting/vscode-arch.png)

There is a [language server extension guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide) available here. An extension must make use of `vscode-languageclient` to implement a language client and server.

## Type 1 - "One-and-dones"

For extensions which do not run a langauge server, a common term is "one-and-done".

Examples of this are Prettier and Mocha (non-watch mode). Where the extension/compiler runs once and then ends until it is called into action again, perhaps via a file save (assuming it respects your preference for `editor.formatOnSave`, which most extensions do).

They can be less performant than Langauge Server as no data or information is persisted and must run in its entirety each time. However:

- there is no complex communication required between server and client.
- for something like Prettier which reformats the entire file, it would require sending a huge amount of data between the client and server, so doing it all on the main extension process in the long run might be more performant.

---

# 3. Our own Prettier extension

We are going to build a VSCode extension which will be a stripped down version of Prettier. It will run for 2 different scenarios.

### Scenario 1

#### Before

```javascript
myFunction()
```

#### After

```javascript
myFunction()
```

So for scenario 1 it will respect that no arguments are given and not change anything.

### Scenario 2

#### Before

```javascript
myFunction(one, two, three)
```

#### After

```
myFunction(
  one,
  two,
  three
);
```

So for scenario 2 it will recognise the arguments, format them correctly and update the code in our file.

## Lets get started 💪

### 1. JSON setup

Add necessary setup to `package.json`

```json
  "main": "./src/extension",
  "publisher": "craig-vscode-extension",
  "activationEvents": [
    "onCommand:extension.SexifyIt"
  ],
  "contributes": {
    "commands": [
      {
        "command": "extension.SexifyIt",
        "title": "Sexify it"
      }
    ]
  },
```

This will

- tell VSCode the extension JavaScript can be found in `./src/extension`
- register our extension to run on activation (when it starts), see `activationEvents`
- tell VSCode to title our extension under `Sexify it` inside the VSCode command palette.

Aswell as a simple launch file `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "extensionHost",
      "request": "launch",
      "name": "Launch Client",
      "runtimeExecutable": "${execPath}",
      "args": ["--extensionDevelopmentPath=${workspaceRoot}"]
    }
  ]
}
```

This is so VSCode knows how to run our client.

### 2. Build a basic text replacement extension

Inside `src/extension.js` add the below.

![Extension activation code](/images/auto-formatting/activation-code.png)

Lets walk through what it is doing

- line 2 register our extension `"extension.SexifyIt"`
- line 6 grabs the current active editor
- line 9 grabs all the document text
- line 10 grabs the range details for the current selected text (it needs a range for the `replace` function)
- line 13 calls our processing and reprinting function returning the new code, more on that in a moment
- line 16/17 replaces the current selected range with our newly formatted code

### 3. AST processing and reprinting

Inside the same file we define some AST utilities.

![AST utilities](/images/auto-formatting/ast-utils.png)

- line 2-5 are simple character utilities
- line 6 is a small function for an "Expression" statement (e.g. `myFunction()`)
- the `Statements` object contains functions for each AST node type, with knowledge of how to "reprint" them i.e. turn AST back into JavaScript. It contains an `ExpressionStatement` and a `CallExpression`, which is what we need for our scenarios.

The bulk of the processing is on line 21-28.

- grab number of arguments in function - line 21
- if not greater than 0 (line 22) return as is
- else we add a line break (line 23) and process each argument (line 26)
- details of line 26:
  - add an "indent" then the "argument name"
  - check if it is last argument, if not add a coma followed by a line break, else just add line break
- finally on line 29 we return an array of all the strings

Our function would output the following from the above:

`["myFunction", "(", "\n", " one,\n", " two,\n", " three\n", ")"]`

It contains all the necessary code including the updated formatting. Notice the line breaks and indents.

#### Finally the code to kick it off

![AST utilities](/images/auto-formatting/parse-reprint.png)

- line 2 we convert out function string into an AST object
  - using a 3rd party tool called `abstract-syntax-tree` for this
- line 4 we map over each item in the `body`
  - the `body` is an array of each "block" (sometimes a line, sometimes an entire function)
- we call the `Statements` function for that AST node type (i.e. here will be `CallExpression`)
- lastly on line 5 and 6 we flatten the new array and rejoin it so it becomes a string again.

## Checking it works

So by running our extension in debugger mode (i.e. F5) we can open a file with our JavaScript in (example in `files/test.js`), highlight the code, open the "Command Palette" and find our "Sexify it" extension.

![Our extension](/images/auto-formatting/sexify-it.png)

It will turn...

```javascript
myFunction(one, two, three)
```

Into this

```
myFunction(
  one,
  two,
  three
);
```

Confirming it works 👍. Converts our single-line function into multi-line with all the correct indents, exactly like Prettier does.

---

Thanks so much for reading or watching, I learnt a huge amount about VSCode and auto formatters from this research and I hope it was useful for you. You can find the repository for all this code [here](https://github.com/craigtaub/our-own-prettier).

Thanks, Craig 😃
