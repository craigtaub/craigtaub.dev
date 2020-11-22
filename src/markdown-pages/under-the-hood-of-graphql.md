---
path: "/under-the-hood-of-graphql"
date: "2020-11-12"
title: "Under-the-hood of GraphQL"
---

In recent years GraphQL has really taken off as a pattern/library/type system. It offers much which REST does not and its standardisation and flexibily has really helped in its adoption. When I began looking for a detailed explanation of how graphql works internally I struggled to find anything which was not too high-level. I wanted to see how the schema, query, types and resolvers all worked together mechanically.

Its not possible to focus on all parts in detail in this article so I have focused on the <b>execution</b> part of the query lifecycle.

This is part of my ["under-the-hood of" series](/introducing-my-under-the-hood-of-series):

- [Web bundlers (e.g. Webpack)](/under-the-hood-of-web-bundlers)
- [Type systems (e.g. TypeScript)](/under-the-hood-of-type-systems)
- [Test runners (e.g. Mocha)](/under-the-hood-of-test-runners)
- [Source maps](/source-maps-from-top-to-bottom)
- [React hooks](/under-the-hood-of-react-hooks)
- [Apollo](https://itnext.io/under-the-hood-of-apollo-6d8642066b28)
- [Auto formatters (e.g. Prettier)](/under-the-hood-of-vscode-auto-formatters)

A video for this talk can be found [here - TODO](). Part of my "under-the-hood of" series [here](https://www.youtube.com/channel/UCYi23MnKBKn0yLZKBrz5Bfw).

The article today will be broken down into 2 parts:

1. [Overview](#1-overview)
2. [Building our own graphql library](#2-building-our-own-graphql-library)

---

## 1: Overview

first we need to ask, what is graphql?

Its:

1. A type system - type definitions define how data shud look, they are written to shows what is included and how things relate. This system definition language can be transformed into AST.
2. A formal language for querying data - what to fetch from where.
3. Rules for validating or executing a query against the Schema.

There is an official <b>Spec</b> which defines the rules for types, validation and executing the schema. It can be found at:

- http://spec.graphql.org/

There is also a documentation-friendly website:

- https://graphql.org/learn

All languages follow the spec and the JS `graphql` library frequently references part of it.

### Building schema

Building the schema is important part for a graphql application, as mentioned above it defines all types and their relationships. There are 2 steps to this

1. Parses "schema notation" (usually found in a `schema.graphql` file) into AST

The parser will throw errors if it is not a GraphQL schema. See snippet from [types/schema.js](https://github.com/graphql/graphql-js/blob/master/src/type/schema.js#L52) (below)

```javascript
export function isSchema(schema) {
  return instanceOf(schema, GraphQLSchema)
}
```

2. Transform AST into objects and instances

We need objects of the type `GraphQLSchema` (see above snippet). We then need objects for every type in the schema, for example [scalar](https://github.com/graphql/graphql-js/blob/master/src/type/definition.js#L575) or [object](https://github.com/graphql/graphql-js/blob/master/src/type/scalars.js#L180)

Essentially at this step we turn graphql schema notation

```typescript
type Book {
  id: ID!
  title: String
  authors: [Author]
}
```

into this Javascript

```javascript
const Book = new GraphQLObjectType({
  name: 'Book',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    title: { type: new GraphQLString },
    author: { type: new GraphQLList(Author) },
  })
}
```

Almost all of the GraphQL types that you define will be object types. Object types have a name, but most importantly describe their fields.

A GraphQLSchema looks like the below in raw POJO form:

```
GraphQLSchema {
  astNode: {
    kind: 'SchemaDefinition',
    ...
  },
  extensionASTNodes: [],
  _queryType: Query,
   ...
  _typeMap: {
    Query: Query,
    ID: ID,
    User: User,
    String: String,
    ...
  },
  ...
}
```

It holds AST information too but the root Query and types are found under the `_typeMap` property.

<b>Resolves</b> are also added to this property, under `_typeMap.<Type>._fields.<field>`
So after adding the resolvers to a schema object might look like below:

e.g.

```javascript
 _typeMap: {
   Query: { _fields: { users: { resolve: [function] } } },
   User: { _fields: { address: { resolve: [function] } } }
}
```

From the HTTP request side the community has largely standardized on a HTTP POST method. But what happens when the server receives a query?

### Query lifecycle

The GraphQL spec outlines what is known as the "request lifecycle". This details what happens when a request reaches the server to produce the result.

There are 3 steps what occur once the lifecycle is triggered.

#### 1. Parse Query

Here the server turns the query into AST. This includes

- Lexical Analysis
  - GraphQL's Lexer identifies the pieces of the GraphQL query.
- Syntactic Analysis

If both these pass the server can move on.

In `graphql-js` this is all found under the [`parser()`](https://github.com/graphql/graphql-js/blob/dd0297302800347a20a192624ba6373ee86836a3/src/language/parser.js#L137) file and function.

The query:

`query homepage { posts { title author } }`

Becomes the AST

```json
{
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "query",
      "name": {
        "kind": "Name",
        "value": "homepage"
      },
      "selectionSet": {
        "kind": "SelectionSet",
        "selections": [
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "posts"
            },
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [
                {
                  "kind": "Field",
                  "name": {
                    "kind": "Name",
                    "value": "title"
                  }
                },
                {
                  "kind": "Field",
                  "name": {
                    "kind": "Name",
                    "value": "author"
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

You can see this for yourself on [astexplorer](https://astexplorer.net/) under GraphQL.

#### 2. Validate Query

This step ensures the request is executable against the provided Schema. Found under the [`validate()`](https://github.com/graphql/graphql-js/blob/dd0297302800347a20a192624ba6373ee86836a3/src/validation/validate.js#L36) in the `graphql-js` library.

While it is usally run just before execute, it can be useful to run in isolation. For exampple by a client before sending the query to the server. No point wasting a HTTP request if the query is invalid.

It works by checking each field in the query AST document against its corresponding type definition in the schema object. It will do argument type compatibility as well as coercion checks.

#### 3. Execute Query

This step is by far the most intensive and the step I often found the most confusing in its mechaisms. We will be digging deeper into this step in part 2, so lets look at the process involved from a high-level.

1. Identify the operations i.e. a query of mutation (several queries can be made at once).
2. Then resolve each operation.

For step (2) each query/mutation is run in isolation. Iterates over each field in the selection-set, if it is a scalar type resolve the field (`executeField`) else recurse the selection-sets until it resolves to a scalar.

The way this works is that the engine calls all fields on the root level at once and waits for all to return (this includes any promises). Then after reading the return type it cascades down the tree calling all sub-field resolvers with data from the parent resolver. Then repeats the cascade on those field return types. So simply speaking it calls the top-level Query initially and then the root resolver for each type.

The mechanism caled "scalar coercion" comes into play here. Any values returned by the resolver are converted (based on the return type) in order to uphold the API contract. For example a resolver returning string "123" with a number type attached to it will return `Number("123")` (i.e a number).

This is found under the [`execute()`](https://github.com/graphql/graphql-js/blob/dd0297302800347a20a192624ba6373ee86836a3/src/execution/execute.js#L103) file and function inside `graphql-js`.

Lastly the result is returned.

### Introspection system

Its worth mentioning the introspection system. This is a mechanism used by the GraphQL API schema is to allow clients to learn what types and operations are supported and in what format.
The clients can query the `__schema` field in the GraphQL API, which is always available on the root type of a Query.
Any interactive graphql UIs rely on sending an `IntrospectionQuery` request to the server, which builds documentation and autom-completion with it.

### Libraries

As part of my research I covered many different libraries, so I thought it was worth giving a quick overview of the main ones in the JS ecosystem.

#### [graphql-js](https://github.com/graphql/graphql-js)

The reference implementation of the GraphQL spec, but also full of useful tools for building GraphQL servers, clients and tooling.
It's a GitHub organisation with many mono-repositories.

##### Schema

Requires library specific `GraphQLSchema` instance.
In order to be an executable schema, it requires resolve functions.
Resolve functions can return

- Value
- Promise
- Array of promises

It performs the entire Query Lifecycle. See above.
It can parse schema notation.

##### Functions

`buildClientSchema`

- Take output of introspection query + build schema out of it
- https://github.com/graphql/graphql-js/blob/dd0297302800347a20a192624ba6373ee86836a3/src/utilities/buildClientSchema.js#L76

`buildASTSchema`

- First parse schema into AST
- This then transforms into GraphQLSchema

#### [graphql-tools](https://github.com/ardatan/graphql-tools)

It's an abstraction on top of `graphql-js`. lots of functionality including generating a fully spec-supported schema and stitching multiple schemas together.

##### Functions

`makeExecutableSchema`

- takes argument `typeDefs` - "GraphQL schema language string", or array
- takes argument `resolvers` - is an object or array of objects
- Returns GraphQL.js `GraphQLSchema` instance

`loadSchemaSync`

- Point to source to load schema from
- Returns a `GraphQLSchema`

`addResolversToSchema`

- Takes `GraphQLSchema` and `resolvers`
- Returns an updated [`GraphQLSchema`](https://github.com/ardatan/graphql-tools/blob/master/packages/schema/src/addResolversToSchema.ts#L36)

#### apollo-server

It's also an abstraction on `graphql-js`. Uses `graphql-tools` library for building GraphQL servers.

Introspection is disabled on production by default. Exposes `/graphql` playground, via introspection.

#### apollo-engine

Plug into `apollo-server` and supplies a host of functionality such as:

- Monitor operations
- Track errors
- Profile resolvers (see example on below screen)

<img src="/images/graphql/apollo-engine.png" alt="apollo-engine" width="350px">

---

## 2: Building our own graphql library

Here we will build our own GraphQL `execute` function that a parsed query and our schema can run against. It will ignore any validation. It will use GraphQL instance types to create a schema, ignoring the schema parsing step.

We saw earlier in the query lifecycle section that the [graphql-js](https://github.com/graphql/graphql-js/blob/master/src/index.js) library contains the necessary functions and they can be imported individually for usage. e.g. `parser()`, `validate()`, `execute()`. In addition to those functions it also exports type instances which can be used to build up a graphql schema. While we will NOT be using any of the functions but we will be using the type intances to build a valid schema.

We will be using 3 different scenarios to examine the mechanism in place.

Before we go any further here are some of the common terms mentioned.

#### Terminonology

- Definitions
  - Name for top-level statements in the document
  - Most GraphQL types you define will be object types. They have name and describe fields
- Operations
  - The type of request i.e query/mutation
- Selections
  - They are definitions that appear at single level of a query
  - For example field references e.g `a`, fragment spreads e.g `...c` and inline fragment spreads `...on Type { a }`
  - [In the spec](https://spec.graphql.org/June2018/#sec-Execution)
- Execution Context
  - Data that must be available at all points during the queries execution.
  - Includes the Schema of the type system currently executing and fragments defined in the query document
  - It is passed into the resolver as `context`
  - Commonly used to represent an authenticated user or request-specific cache
- Resolvers
  - Functions to populate data for a field in your Schema
  - They cannot be included in the GraphQL schema language, so they must be added separately

This part is split into 2 steps.

1. [Step 1 - query and schema](#step-1---query-and-schema)
2. [Step 2 - Execute](#step-2---execute)

### Step 1 - query and schema

Step 1 is to create query AST and schema instances (off graphql-js) to process.

These are the types which we will be importing from the "graphql" library.

<img src="/images/graphql/imports.png" alt="imports" width="350px">

The query will look like below, it is close to how a normal graphql query would run, except usually there is an extra `parse(query)` step before execution.

```javascript
// "document" = is our query in AST form
const schema = new GraphQLSchema({ …<schema objects> })
// class instances of root-level query, fields, types, resolvers
ourExecute({ schema, document });
// execute query AST with schema
```

Norally this would be:

```javascript
// schema = built from "schema.graphql" and "graphql-tool" loadSchemaSync/makeExecutableSchema/addResolversToSchema
const document = parse(query)
execute({ schema, document })
```

Each scenario below will contain 2 images.

1. The query AST - This is the query put into AST form (see comment for pre-AST form)
2. The schema - This is how the schema looks (see comment for pre-schema parsing form)

#### Scenario one

- Root query with resolver args
- Query: `{ test(aInt: -123) }`

Query AST

<img src="/images/graphql/scenario-1-ast.png" alt="imports" width="350px">

Schema

<img src="/images/graphql/scenario-1.png" alt="scenario-1" width="350px">

#### Scenario two

- Root query with inner object and resolver args
- Query: `{ test(aInt: -123) { name } }`

Query AST

<img src="/images/graphql/scenario-2-ast.png" alt="imports" width="350px">

Schema

<img src="/images/graphql/scenario-2.png" alt="scenario-2" width="350px">

#### Scenario three

- A root type with inner object
- Query: `{ person { name } }`

Query AST

<img src="/images/graphql/scenario-3-ast.png" alt="imports" width="350px">

Schema

<img src="/images/graphql/scenario-3.png" alt="scenario-3-a" width="350px">

### Step 2 - Execute

Now that we have the setup complete for 3 scenarios we will look to build our actual execute function.

<img src="/images/graphql/execute-2.png" alt="execute-2" width="500px">

Starts on line 54. Here we call execute with our first definition as well as the types map.

Inside `execute` (line 3) we process the first selection in the selection set (line 8, hardcoded for this POC). We then grab the `returnType` (line 10) this would be used for validation against the query result, I have omitted that here.

On line 13 we check for arguments and grab the argument name and value. We could also grab the type (line 16) which would be used for validation.

We define `executeField` on line 19, we will go through that next. Lastly we call `executeFields` with our current selection-set and and empty object. This will be our response.

<img src="/images/graphql/execute-3.png" alt="execute-3" width="500px">

Now on to `executeFields`. We pass the selection-set, response object and field type as arguments. This is so we can call the query tree recursively and build the response `data` as we go along.

Line 19 we iterate over all selection-set selections. We grap the field (line 21) and check for it on the root query level (line 24).

If it exists we call the resolver with the argument name and value, and then place the resolver data onto the field on the response (line 28). Scenario 1 will be caught here.

Line 32 we then check if the return types field exists on the root types object. If so we execut eit with the parents resolver data and then write that to the field on the response (line 36).

If this selection has got selection-sets itself we execute those (see line 41). We hand the selection-set, the current response data for this field, and the field name.

Lastly we return the build response data on line 48, see `userResp`.

Its worth noting we have omitted any scalar checks, with the real `graphql-js.execute` the field type is checked as part of the validation to make sure it is isn't a scalar it will have sub selections.

#### Checking results

In order to check this would work I wrote some unit tests found [here](https://github.com/craigtaub/our-own-graphql-server/blob/master/test/execute.spec.js). I initially ran them against `graphql-js.execute()` to ensure they were written correctly. I then swapped to using my executor. The schema objects are those show earlier, but this is all of it together.

Scenario 1 looks like this

<img src="/images/graphql/test-1.png" alt="test-output" width="500px">

Scenario 2 looks like this

<img src="/images/graphql/test-2.png" alt="test-output" width="500px">

Scenario 3 looks like this

<img src="/images/graphql/test-3.png" alt="test-output" width="500px">

A summary of the data assertions is here:

<img src="/images/graphql/test-output.png" alt="test-output" width="500px">

Here is the results of the test runner:

<img src="/images/graphql/test-results.png" alt="test-output" width="500px">

It works !!! Good job 👍💪

---

## What have we missed

As mentioned there are many additional parts to the real graphql executor which we have omitted from our library. Some of those are:

- Scalar type checks and scalar coercion
- Processing multiple queries at once
- Building response data not via pass-by-ref
- Handling more complex scenarios
- Validation of query (including errors)
- Execution context - would be passed into the resolver.

---

Thanks so much for reading or watching, I learnt a huge amount about graphql from this research and I hope it was useful for you. You can find the repository for all this code [here](https://github.com/craigtaub/our-own-graphql-server).

Thanks, Craig 😃
