---
path: "/under-the-hood-of-graphql-dataloader"
date: "2022-03-11"
title: "Under-the-hood of GraphQL DataLoader"
---

In recent years GraphQL has really taken off as a pattern/library/type system. It offers much which REST does not and its standardization and flexibility has really helped in its adoption. I have an article focused on digging [deeper into GraphQL here](/under-the-hood-of-graphql), so today we will focus on another tool in the GraphQL ecosystem - one that is very important and interesting in how it assists applications - that tool is the DataLoader.

This is part of my ["under-the-hood of" series](/introducing-my-under-the-hood-of-series):

- [React hooks](/under-the-hood-of-react-hooks)
- [Web bundlers (e.g. Webpack)](/under-the-hood-of-web-bundlers)
- [Type systems (e.g. TypeScript)](/under-the-hood-of-type-systems)
- [GraphQL](/under-the-hood-of-graphql)
- [Git version control](/under-the-hood-of-git)
- [Source maps](/source-maps-from-top-to-bottom)
- [Docker](/under-the-hood-of-docker)
- [NPM](/under-the-hood-of-npm)
- [Test runners (e.g. Mocha)](/under-the-hood-of-test-runners)
- [VSCode auto formatters (e.g. Prettier)](/under-the-hood-of-vscode-auto-formatters)
- [Apollo](https://itnext.io/under-the-hood-of-apollo-6d8642066b28)

---

The article today will be broken down into 2 parts:

1. [Overview](#1-overview)

   - [Batching](#caching)
   - [Caching](#caching)

2. [Building our own GraphQL DataLoader](#2-building-our-own-graphql-dataloader)


---

## 1: Overview

The NodeJS repository for GraphQL's DataLoader is found at [https://github.com/graphql/dataloader](https://github.com/graphql/dataloader), however it can be found in many different language implementations. It can be used as part of your applications data fetching layer, and its basic job is to reduce requests to backends by 2 means.
1. Batching
2. Caching

It utilizes different logic and functionality to perform the above efficiently.

The first question is what does GraphQL have to do with this?

It pairs nicely with GraphQL as GraphQL has fields which are designed to be stand-alone functions (resolvers) and it is very easy to share a class instance via the context. The class instance would be our instance of DataLoader. 

The natural pairing of DataLoader and GraphQL has produced high success rates - some examples have seen 13 database queries reduced down to 3 or 4.

## Batching

Batching is the primary feature of DataLoader, you must pass the library a "batch function" to detail how to process the batch.
Within a single tick of the event loop DataLoader gathers all individual loads, then calls the "batch loading function" with all requested keys. 

### VS your ORM

Its important to note DataLoader does not optimize the queries itself - you can look to an ORM for help there. For example [Objection-JS](https://vincit.github.io/objection.js/api/query-builder/eager-methods.html#withgraphfetched) has logic to avoid "N+1 selects" by utilizing "where in" queries. 

### Batch function

This is the function given to the library when you create a new instance

```javascript
const ourInstance = new DataLoader(keys => myBatchFunction(keys))
```

The basic idea is that you check your cache first for a given key, if it exists return that value, else hit the data-source e.g database.

It passes in an array of keys, but there is a constraint that:
1) the returned array size must match the keys coming in
2) the returned array indexes must match the keys coming in

There is a sound reason for that limitation and it's related to the implementation - it is covered in part 2 below.

Its worth highlighting that keys are suited to table column ID's, so it stands to reason that having a database table for each entity in your data model would fit this mechanism well.

## Caching

DataLoader uses a simple in-memory memoization cache. You can swap the memory store for something else e.g. SQL-lite.

Caching pairs really well with the Batching, because the batch can ensure the requested data has already been pulled from the database, the cache can be utilized to retrieve from there. We will go over this more in the next section

---


## 2. Building our own GraphQL Dataloader

In this section we will focus on the <batching> and save <caching> for another time. Hopefully it will provide enough context on how caching is utilized.

> Within a single tick of the event loop DataLoader gathers all individual loads, then calls the "batch loading function" with all requested keys.

You might be wondering how it does this - so let's look at the most simple example.

```javascript
const run = async () => {
  const keys = [];
  const batchFunction = (keys) => {
    // bad point 1 - called with [1,2], [1,2]
    console.log("keys: ", keys);
  };

  const load = async (id) => {
    keys.push(id);
    process.nextTick(() => {
      batchFunction(keys);
    });
    // bad point 2 - promise not connected to batch function
    return Promise.resolve(`id: ${id}`);
  };

  const a = await load(1);
  const b = await load(2);
  console.log("a", a); // id: 1
  console.log("b", b); // id: 2
};

run();
```

This calls our batch function twice - both times with both keys.
The order of events is this:
1. call `load` asynchronously with id 1
2. call `load` asynchronously with id 2
3. `async load(1)`
    - store key 1 in the global `keys` array
    - schedule a node process to, on the next tick, run our `batchFunction` with those keys
    - Return a resolved promise with the id.
4. `async load(2)`
    - store key 2 in the global `keys` array
    - schedule a node process to, on the next tick, run our `batchFunction` with those keys
    - Return a resolved promise with the id.
5. The first scheduled process runs, with both ids 1 and 2 in the `keys` array
6. The second scheduled process runs, with both ids 1 and 2 in the `keys` array.

So here you can see the basic mechanism of how batching works.

Good 👍🏻
- Runs our batch function with both keys - this will mean we can cache the database response, and next time those keys are included only utilize cache

Bad 👎🏻
1. Unnecessarily calling the batch function with the same keys, unnecessarily running the code even if it is hitting the cache.
2. `load` does not return anything useful, its a completely isolated resolved promise.

The below example looks to improve on that. 

```javascript

let resolvedPromise;
let batchFunction;
let batch;

const dispatchBatch = () => {
  batch.hasDispatched = true;
  const batchPromise = batchFunction(batch.keys);

  batchPromise.then((values) => {
    for (var i = 0; i < batch.callbacks.length; i++) {
      var value = values[i];
      // resolve promise callback
      batch.callbacks[i].resolve(value);
    }
  });
};

const batchScheduleFn = (cb) => {
  // add more logic if scheduling
  process.nextTick(cb);
};

const getCurrentBatch = () => {
  // !hasDispatched only needed if using a 2nd tick - this example isnt
  if (batch && !batch.hasDispatched) {
    return batch;
  }
  const newBatch = { hasDispatched: false, keys: [], callbacks: [] };
  batch = newBatch;
  batchScheduleFn(() => {
    dispatchBatch();
  });
  return newBatch;
};

const load = async (id) => {
  const localBatch = getCurrentBatch();
  localBatch.keys.push(id);
  // add promise callback to batch
  const promise = new Promise((resolve, reject) => {
    localBatch.callbacks.push({ resolve, reject });
  });

  return promise;
};

async function threadTwo() {
  const user = await load(2);
  console.log("threadTwo user", user.id);
}

async function threadOne() {
  const user = await load(1);
  console.log("threadOne user", user.id);
}

const run = async () => {
  // make async
  batchFunction = async (keys) => {
    console.log("keys:", keys);
    // keys: [ 1, 2 ]
    return keys.map((key) => ({ id: key }));
  };

  threadOne();
  threadTwo();
};

run();
```

It introduces batches which can be sheduled - this is _exactly_ how DataLoader manages it ([here](https://github.com/graphql/dataloader/blob/master/src/index.js#L248)).

The order of events is this:
1. call `threadOne` - call `load` async with id 1
2. call `threadTwo` - call `load` async with id 2
3. `async load(1)` 
    - get the current batch
        - `batch` is currently undefined so a `newBatch` is created 
        - we schedule a dispatch by calling `dispatchBatch()` inside our scheduler `batchScheduleFn()`
            - this adds `dispatchBatch` callback to the `nextTick`.
        - lastly we return the batch
    - we add the `id` to the `keys` array on the current batch
    - we create a new promise, add the `reject` and `resolve` to our current batch `callbacks` (so the list index is important)
    - lastly we return the new promose
4. `async load(2)`
    - get current batch
      - `batch` currently exists and has not been dispatched so we return that
    - as above we add the `id` and `reject/resolve` to the current batch
    - as well as return the promise
5. `process.nextTick`
    - the tick runs `dispatchBatch`
    - call our `batchFunction` with the current batches `keys`
      - `batchFunction` returns a promise
    - when that promise resolves (`.then`), it returns an array of our keys
    - we iterate over our batch callbacks - for each callback 
      - we find the associated `batchFunction` key value <b>this is why the batch function response indexes are so important</b>
      - resolve the callback with that value
6. `await load(1) resolves`
    - returning object `{id}`
7. `await load(2) resolves`
    - returning object `{id}`

This calls the batch function once with both keys, it returns correct values from batch function - dealing with both "bad" points from the first example.

---

Thanks so much for reading, I learnt a huge amount about DataLoader and GraphQL from this research and I hope it was useful for you. You can find the repository for all this code [here](https://github.com/craigtaub/our-own-graphql-dataloade).

Thanks, Craig 😃
