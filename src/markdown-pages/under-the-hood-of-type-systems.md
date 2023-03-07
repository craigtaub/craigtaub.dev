---
path: "/under-the-hood-of-type-systems"
date: "2020-05-08"
title: "Under-the-hood of type systems (e.g. TypeScript)"
---

I struggled to find an explanation from a low-level view of exactly how a **"JavaScript type system compiler"** is implemented. I understood many of the jobs of a type system but was unsure of the mechanisms involved and how they worked together.

This article looks to shine a light on some of the fundamentals at work under-the-hood. It is not possible to focus on everything in 1 article so here we will be looking at **"type checks"** specifically. Starting with an overview of type systems then building our own compiler which can run type checks and output sensible messages. For more help on transforms please see my article or talks on [Web Bundlers](https://craigtaub.dev/under-the-hood-of-web-bundlers) or [Source Maps](https://craigtaub.dev/source-map-from-top-to-bottom).

This is part of my ["under-the-hood of" series](/introducing-my-under-the-hood-of-series):

- [Source maps](https://craigtaub.dev/source-maps-from-top-to-bottom)
- [React hooks](https://craigtaub.dev/under-the-hood-of-react-hooks)
- [Web bundlers (e.g. Webpack)](https://craigtaub.dev/under-the-hood-of-web-bundlers)
- [Apollo](https://itnext.io/under-the-hood-of-apollo-6d8642066b28)

A video for this talk can be found [here](https://www.youtube.com/watch?v=QnQnv6uZNek). Part of my "under-the-hood of" series [here](https://www.youtube.com/channel/UCYi23MnKBKn0yLZKBrz5Bfw).

NOTE: Apologies as there is some repetition in this article with my previous article on [Source Maps](https://itnext.io/source-maps-from-top-to-bottom-597bbc07436). But it is important to include all of the necessary information to understand the mechanisms we will be looking at today.

This article will be broken down into (click links to navigate):

**PART A:** Overview of type system compilers (including TypeScript)
Syntax vs Semantics

- What is AST?
- Types of compilers
- What does a language compiler do?
- How does a language compiler work?
- Type system compiler jobs
- Advanced type checker features

**PART B:** Building our own type system compiler

- The parser
- The checker
- Running our compiler
- What have we missed?

Lets make a start 💪

---

# PART A: Overview of type system compilers

## Syntax vs Semantics

Something which is important to run over early is the difference between syntax and semantics.

### Syntax

Is typically code which is native to JavaScript. Essentially asking if the given code is correct for the JavaScript runtime. For example the below is syntactically correct:

```javascript
var foo: number = "not a number"
```

### Semantics

This is code specific to the type system. Essentially asking if the given types attached to the code are correct. For example the above is syntactically correct BUT semantically wrong (defining the variable as a number but setting a string).

Next onto AST and compilers in the JavaScript ecosystem.

---

## What is AST?

Before we go much further we need to take a quick look at one of the important mechanisms inside any JavaScript compiler, AST.

AST stands for _"Abstract Syntax Tree"_, it is basically a tree of _"Nodes"_ representing a Program of code. A _"Node"_ is the smallest possible unit and is basically a POJO (i.e. plain old js object) with _"type"_ and _"location"_ properties. All Nodes have these 2 properties but based on the _"type"_ they can have various other properties as well.

In AST form code is very easy to manipulate so operations like adding, removing or even replacing are do-able.

An example is the below code:

![Alt Text](https://dev-to-uploads.s3.amazonaws.com/i/fxutt1d8z4v6xzfc940v.png)

Would become the following AST:

![Alt Text](https://dev-to-uploads.s3.amazonaws.com/i/rdqlqf6ybevnknibutne.png)

There are websites such as [https://astexplorer.net/](https://astexplorer.net/) which are great at letting you write JavaScript code and immediately see its AST.

---

## Types of compilers

There are 2 main types of compilers in the JavaScript ecosystem

### 1. Native compiler

A native compiler will convert code into a form that can be run by a server or computer (i.e. machine code). A compiler such as the one found in the Java ecosystem converts code into bytecode and then into native machine code.

### 2. Language compiler

A language compiler has a quite different role. The compilers for TypeScript and Flow both count in the category as language compilers as they output code into JavaScript. The main difference with native compilers is that they compile for tooling-sake (e.g. optimising code performance or adding additional features) not to produce machine code.

---

## What does a language compiler do?

Let us start with the basics. A couple of the core jobs found in a type system compiler are:

### 1. Performing type checks

By this I mean the introduction of "types" (often via explicit annotations or implicit inference) and a way to check that 1 type matches another e.g. string vs number.

### 2. Running a language server

For a type system to work in a development environment it is best if it can run any type checks in an IDE and provide instant feedback for the user. Language servers connect a type system to an IDE, they can run the compiler in the background and re-run when a user saves a file. Popular languages such as TypeScript and Flow both contain a language server.

### 3. Transforming code

Many type systems contain code which is not supported in native Javascript (e.g. type annotations are not supported) so they must transform from unsupported JavaScript to supported JavaScript.

As mentioned at the very top we will be focusing on point **(1) Performing type checks**. If it seems valuable we could explore (2) language servers in the future. My articles on [Web Bundlers](https://craigtaub.dev/under-the-hood-of-web-bundlers) and [Source Maps](https://craigtaub.dev/source-maps-from-top-to-bottom) go into more detail about (3) transforming code.

---

## How does a language compiler work?

Next we will have a look at the steps required to perform all of the above jobs in an efficient and scalable way. There are 3 common stages to most compilers in some form or another.

### 1) Parse source code into AST

- _Lexical analysis_ -> Turn string of code into a stream (i.e. an array) of tokens.
- _Syntactic analysis_ -> Turn stream of tokens into its AST representation

Parsers check the _"syntax"_ of given code. A type system will have to house its own parser, often containing thousands of lines of code.

The [Babel parser](https://babeljs.io/docs/en/babel-parser) contains 2,100 lines of code just to process code statements (see it [here](https://github.com/babel/babel/blob/v7.9.6/packages/babel-parser/src/parser/statement.js)) which can understand the syntactical analysis of any compiler-specific code but also append additional information for types.

Hegel appends a `typeAnnotation` property to code which has a type annotation (you can see it doing it [here](https://github.com/JSMonk/hegel/blob/769ed2368690f6f38dadb921a99f1382ad1ef708/packages/core/src/utils/type-utils.js#L65)).

TypeScript's parser is a whopping 8,600 lines of code (find where it begins traversing the tree [here](https://github.com/microsoft/TypeScript/blob/v3.9.2/src/compiler/parser.ts#L73)). It houses an entire superset of JavaScript which all requires the parser to understand.

### 2) Transform nodes on AST 

- Manipulate AST nodes

Here any transformations to apply to the AST are performed.

### 3) Generate source code 

- Turn AST into string of JavaScript source code

A type system has to map any non-JS compliant AST back to native JavaScript.

But how does a type system fit into that?

---

## Type System compiler jobs

As well as the above steps, Type system compilers will usually include an additional step or 2 after **"parsing"** which will include the type-specific work.

On a side-note TypeScript actually has a total of 5 phases in its compiler, they are:

1. Language server pre-processor
2. [Parser](https://github.com/microsoft/TypeScript/blob/v3.9.2/src/compiler/parser.ts)
3. [Binder](https://github.com/microsoft/TypeScript/blob/v3.9.2/src/compiler/binder.ts)
4. [Checker](https://github.com/microsoft/TypeScript/blob/v3.9.2/src/compiler/checker.ts)
5. [Emitter](https://github.com/microsoft/TypeScript/blob/v3.9.2/src/compiler/emitter.ts)

As you can see above the language server contains a **pre-processor** which triggers the type compiler to only run over the file/s which has changed. This will follow any _"import"_ statements to determine what else could have changed and would need to be included in the next re-run. Additionally the compiler has the ability to only re-process the branch of the AST graph which has changed. More on "lazy compilation" below.

There are 2 common jobs to the type system compiler:

### 1. Inferring

Inferring is required for code which does not have an annotation. On that subject there is a really interesting blog post [here](https://effectivetypescript.com/2020/04/28/avoid-inferable/) on when to use type annotations and when to let the engine use Inference.

Using a pre-defined algorithm the engine will calculate what the type for a given variable/function is.

TypeScript uses the algorithm _"best common type"_ inside of its **Binding** phase (the 1st of 2 semantic passes). It considers each candidate type and picks the type that is compatible with all the other candidates. Contextual typing comes into play here i.e. using the location in the inference. There is more help on this in the TypeScript spec [here](https://github.com/microsoft/TypeScript/blob/v3.9.2/doc/spec.md). TypeScript actually introduces the idea of **"Symbols"** (interface [here](https://github.com/microsoft/TypeScript/blob/v3.9.2/src/compiler/types.ts#L4103)) these are named declarations which connect declaration nodes in the AST to other declarations contributing to the same entity. They are the basic building block of the TypeScript Semantic system

### 2. Checking

Now that (1) is complete and types have been assigned the engine can run its type checks. They check the "semantics" of the given code. There are many flavours of these types of checks ranging from type mis-match to type non-existing.

For TypeScript this is the **Checker** (the 2nd semantic pass) and it is 20,000 lines of code long. I feel that gives a really strong idea of just how complicated and difficult it is to check so many different types across so many different scenarios.

The type checker is **NOT dependent on calling code** i.e. if the file executes any of its own code (i.e. at runtime) . The type checker will process each line in a given file itself and run the appropriate checks.

---

## Advanced type checker features

A couple of additional concepts which we will not dig into any deeper today due to the complexity they entail:

### Lazy compilation

A common feature for modern compilations is "lazy loading". They will not recalculate or re-compile a file or AST branch unless absolutely required.

TypeScripts pre-processor can use AST code which is stored in memory from a previous run. This has a massive performance boost as it can just focus on running over a small part of the program or node tree which has changed. TypeScript uses immutable read-only data-structures stored in what it terms _"look-aside tables"_. This makes it easy to know what has/has not changed.

### Soundness

There are certain operations which a compiler can not know is safe at compile-time and must wait for run-time. Each compiler must make difficult choices as to what will and will not be included. TypeScript has certain areas which are said to "not to be sound" (i.e. require run-time type checks).

We will not be addressing the above features in our compiler as they add additional complexity and not worth it for our small POC.

Onto more exciting stuff now, building one ourselves…

---

# PART B: Building our own type system compiler

We are going to build a compiler which can run type checks for 3 different scenarios and throw a specific message for each. The reason we will limit it to 3 scenarios is so we can focus on the specific mechanisms in work around each one, and hopefully by the end have a really strong idea on how to introduce more complex type checks.

We will be working with a **function declaration** and an **expression** (calling that function) in our compiler.

The scenarios are:

(1) Issue with type matching a string vs a number

```javascript
fn("craig-string") // throw with string vs number
function fn(a: number) {}
```

(2) Issue with using an unknown type which is not defined

```javascript
fn("craig-string") // throw with string vs ?
function fn(a: made_up_type) {} // throw with bad type
```

(3) Issue with using a property name not found on the interface

```javascript
interface Person {
  name: string;
}
fn({ nam: "craig" }) // throw with "nam" vs "name"
function fn(a: Person) {}
```

Onto our compiler, there are 2 parts to our compilers, the parser and the checker.

---

## The Parser

As previously mentioned we won't be focusing on a parser today. We will be following the Hegel parsing approach of assuming a `typeAnnotation` object has been attached to all annotated AST nodes. I have hardcoded the AST objects.

_Scenario 1_ will use the below parser:

```javascript
function parser(code) {
  // fn("craig-string");
  const expressionAst = {
    type: "ExpressionStatement",
    expression: {
      type: "CallExpression",
      callee: {
        type: "Identifier",
        name: "fn",
      },
      arguments: [
        {
          type: "StringLiteral", // Parser "Inference" for type.
          value: "craig-string",
        },
      ],
    },
  }

  // function fn(a: number) {}
  const declarationAst = {
    type: "FunctionDeclaration",
    id: {
      type: "Identifier",
      name: "fn",
    },
    params: [
      {
        type: "Identifier",
        name: "a",
        typeAnnotation: {
          // our only type annotation
          type: "TypeAnnotation",
          typeAnnotation: {
            type: "NumberTypeAnnotation",
          },
        },
      },
    ],
    body: {
      type: "BlockStatement",
      body: [], // "body" === block/line of code. Ours is empty
    },
  }

  const programAst = {
    type: "File",
    program: {
      type: "Program",
      body: [expressionAst, declarationAst],
    },
  }
  // normal AST except with typeAnnotations on
  return programAst
}
```

You can see the `expressionAstblock` for our top-line expression statement, and the `declarationAst` for where we have declared our function on the second line. We return a `programAst` which is a program with both AST blocks in.

Inside the AST you can see the `typeAnnotation` the param identifier "a", matching where it sits in the code.

_Scenario 2_ will use the below parser:

```javascript
function parser(code) {
  // fn("craig-string");
  const expressionAst = {
    type: "ExpressionStatement",
    expression: {
      type: "CallExpression",
      callee: {
        type: "Identifier",
        name: "fn",
      },
      arguments: [
        {
          type: "StringLiteral", // Parser "Inference" for type.
          value: "craig-string",
        },
      ],
    },
  }

  // function fn(a: made_up_type) {}
  const declarationAst = {
    type: "FunctionDeclaration",
    id: {
      type: "Identifier",
      name: "fn",
    },
    params: [
      {
        type: "Identifier",
        name: "a",
        typeAnnotation: {
          // our only type annotation
          type: "TypeAnnotation",
          typeAnnotation: {
            type: "made_up_type", // BREAKS
          },
        },
      },
    ],
    body: {
      type: "BlockStatement",
      body: [], // "body" === block/line of code. Ours is empty
    },
  }

  const programAst = {
    type: "File",
    program: {
      type: "Program",
      body: [expressionAst, declarationAst],
    },
  }
  // normal AST except with typeAnnotations on
  return programAst
}
```

It is very similar to _Scenario 1_ with its expression, declaration and program AST blocks. However the difference is the `typeAnnotation` inside params is `made_up_type` instead of what scenario 1 has which is `NumberTypeAnnotation`.

_Scenario 3_ will use the below parser:

```javascript
function parser(code) {
  // interface Person {
  //   name: string;
  // }
  const interfaceAst = {
    type: "InterfaceDeclaration",
    id: {
      type: "Identifier",
      name: "Person",
    },
    body: {
      type: "ObjectTypeAnnotation",
      properties: [
        {
          type: "ObjectTypeProperty",
          key: {
            type: "Identifier",
            name: "name",
          },
          kind: "init",
          method: false,
          value: {
            type: "StringTypeAnnotation",
          },
        },
      ],
    },
  }

  // fn({nam: "craig"});
  const expressionAst = {
    type: "ExpressionStatement",
    expression: {
      type: "CallExpression",
      callee: {
        type: "Identifier",
        name: "fn",
      },
      arguments: [
        {
          type: "ObjectExpression",
          properties: [
            {
              type: "ObjectProperty",
              method: false,
              key: {
                type: "Identifier",
                name: "nam",
              },
              value: {
                type: "StringLiteral",
                value: "craig",
              },
            },
          ],
        },
      ],
    },
  }

  // function fn(a: Person) {}
  const declarationAst = {
    type: "FunctionDeclaration",
    id: {
      type: "Identifier",
      name: "fn",
    },
    params: [
      {
        type: "Identifier",
        name: "a",
        typeAnnotation: {
          type: "TypeAnnotation",
          typeAnnotation: {
            type: "GenericTypeAnnotation",
            id: {
              type: "Identifier",
              name: "Person",
            },
          },
        },
      },
    ],
    body: {
      type: "BlockStatement",
      body: [], // Empty function
    },
  }

  const programAst = {
    type: "File",
    program: {
      type: "Program",
      body: [interfaceAst, expressionAst, declarationAst],
    },
  }
  // normal AST except with typeAnnotations on
  return programAst
}
```

As well as the expression, declaration and program AST blocks there is also an `interfaceAst` block which holds the AST for our `InterfaceDeclaration`. The `declarationAst` now has a `GenericType` on its annotation as it takes an object identifier i.e. `Person`. The `programAst` will return an array of those 3 objects for this scenario.

#### Similarities in the parsers

As you can see from above, the main area which holds the type annotation for all 3 scenarios is the declaration param. All 3 have that in common.

---

## The Checker

Now onto the part of the compiler which does our type checks. It needs to iterate through all the program body AST objects and depending on the node type do the appropriate type checks. We will add any errors onto an array to be returned to the caller for printing.

Before we go any further, the basic logic we will work with for each type is:

- _Function declaration_: check the types for the argument are valid, then check each statement in the block body
- _Expression_: find the function declaration for the caller, grab the type on the declarations argument, lastly grab the type of the expressions caller argument and compare them.

### The code

This snippet contains the `typeChecks` object (and `errors` array) which will be used to check our expression and a basic annotation check.

```javascript
const errors = []

const ANNOTATED_TYPES = {
  NumberTypeAnnotation: "number",
  GenericTypeAnnotation: true,
}

// Logic for type checks
const typeChecks = {
  expression: (declarationFullType, callerFullArg) => {
    switch (declarationFullType.typeAnnotation.type) {
      case "NumberTypeAnnotation":
        return callerFullArg.type === "NumericLiteral"
      case "GenericTypeAnnotation": // non-native
        // If called with Object, check properties
        if (callerFullArg.type === "ObjectExpression") {
          // Get Interface
          const interfaceNode = ast.program.body.find(
            node => node.type === "InterfaceDeclaration"
          )
          // Get properties
          const properties = interfaceNode.body.properties

          // Check each property against caller
          properties.map((prop, index) => {
            const name = prop.key.name
            const associatedName = callerFullArg.properties[index].key.name
            if (name !== associatedName) {
              errors.push(
                `Property "${associatedName}" does not exist on interface "${interfaceNode.id.name}". Did you mean Property "${name}"?`
              )
            }
          })
        }
        return true // as already logged
    }
  },
  annotationCheck: arg => {
    return !!ANNOTATED_TYPES[arg]
  },
}
```

Let us walk through the code. Our `expression` has 2 types of checks:

- For `NumberTypeAnnotation`; the caller type should be a `NumericLiteral` (i.e. if annotated as a number, the caller type should be a number). _Scenario 1_ would fail here but nothing is logged yet.
- For `GenericTypeAnnotation`; if it is an object we search the tree for an `InterfaceDeclaration` and then check each property of the caller on that interface. Any issues get pushed onto the `errors` array, with a helpful message about what property name does exist and therefore what it could actually be. _Scenario 3_ would fail here and get this error.

Our processing is limited to this file, however most type checkers have the notion of _"scope"_ so they would be able to determine if a declaration was anywhere in the runtime. Ours has an easier job as it is just a POC.

This snippet contains the processing of each node type in the program body. This is where the type check logic above is called from.

```javascript
// Process program
ast.program.body.map(stnmt => {
  switch (stnmt.type) {
    case "FunctionDeclaration":
      stnmt.params.map(arg => {
        // Does arg has a type annotation?
        if (arg.typeAnnotation) {
          const argType = arg.typeAnnotation.typeAnnotation.type
          // Is type annotation valid
          const isValid = typeChecks.annotationCheck(argType)
          if (!isValid) {
            errors.push(
              `Type "${argType}" for argument "${arg.name}" does not exist`
            )
          }
        }
      })

      // Process function "block" code here
      stnmt.body.body.map(line => {
        // Ours has none
      })

      return
    case "ExpressionStatement":
      const functionCalled = stnmt.expression.callee.name
      const declationForName = ast.program.body.find(
        node =>
          node.type === "FunctionDeclaration" && node.id.name === functionCalled
      )

      // Get declaration
      if (!declationForName) {
        errors.push(`Function "${functionCalled}" does not exist`)
        return
      }

      // Array of arg-to-type. e.g. 0 = NumberTypeAnnotation
      const argTypeMap = declationForName.params.map(param => {
        if (param.typeAnnotation) {
          return param.typeAnnotation
        }
      })

      // Check exp caller "arg type" with declaration "arg type"
      stnmt.expression.arguments.map((arg, index) => {
        const declarationType = argTypeMap[index].typeAnnotation.type
        const callerType = arg.type
        const callerValue = arg.value

        // Declaration annotation more important here
        const isValid = typeChecks.expression(
          argTypeMap[index], // declaration details
          arg // caller details
        )

        if (!isValid) {
          const annotatedType = ANNOTATED_TYPES[declarationType]
          // Show values to user, more explanatory than types
          errors.push(
            `Type "${callerValue}" is incompatible with "${annotatedType}"`
          )
        }
      })

      return
  }
})
```

Let us walk through the code again, breaking it down by type.

### FunctionDeclaration (i.e. _function hello() { }_)

Start by processing the arguments/params. If you find a type annotation check if the type exists for the argument given i.e. `argType`. If it does not add an error to errors. Scenario 2 would get an error here.

Lastly we process the function body, however as we know there is no function body to process I have left it blank.

### ExpressionStatement (i.e. _hello()_)

First check the program body for the declaration of the function. This is where scope would apply to a real type checker. If no declaration is found add an error to the `errors` array.

Next we check each defined argument type against the caller argument type. If there is a type mismatch found then add an error onto the `errors` array. Both _Scenario 1_ and _Scenario 2_ will get this error.

---

## Running our compiler

I have introduced a basic repository with a simple [index file](https://github.com/craigtaub/our-own-type-system/blob/master/src/index.mjs) which processes all 3 AST node objects in 1 go and logs the errors. When I run it I get the below:

![Alt Text](https://dev-to-uploads.s3.amazonaws.com/i/opdw3vtpkjcb52ey2k3v.png)

So to summarise:

#### Scenario 1

We defined the argument type of number, yet called it with a string

#### Scenario 2

We defined a type on the function argument which does not exist and then we called our function, so we get 2 errors (1 for bad type defined, 1 for type mismatch)

#### Scenario 3

We defined an interface but used a property called nam which was not on the object, we are asked if we meant to use name instead.

It works !!! Good job 👍💪

---

## What have we missed?

As mentioned there are many additional parts to a type compiler which we have omitted from our compiler. Some of those are:

- _The parser_: we manually wrote the AST blocks these would be generated on a real type compiler
- _Pre-processing/language compiler_: A real compiler has mechanisms to plug into the IDE and re-run at appropriate times
- _Lazy compilation_: No intelligence around what has changed or using memory
- _Transform_: we have skipped the final part of the compiler which is where the native JavaScript code is generated.
- _Scope_: as our POC is a single file it did not need to understand the notion of "scope" however real compiler have to always be aware of context.

---

Thanks so much for reading or watching, I learnt a huge amount about type systems from this research and I hope it was useful for you. You can find the repository for all this code [here](https://github.com/craigtaub/our-own-type-system).

Thanks, Craig 😃
