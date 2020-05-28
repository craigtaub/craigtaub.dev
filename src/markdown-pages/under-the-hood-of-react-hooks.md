---
path: "/under-the-hood-of-react-hooks"
date: "2020-04-20"
title: "Under-the-hood of React Hooks"
---

React is filled with interesting design patterns, when Hooks were introduced it cleaned up many of the issues people had with the more arguably frustrating features such as classes and lifecycle methods. Today we will have a look at building our own React engine with Hooks, so we can understand the mechanisms at work for _useState_ and _useEffect_.

We will **not** be covering Fibre, _reconciliation_ or the change detection mechanisms.

This is part of my "under-the-hood of" series:

- [Source maps](https://craigtaub.dev/source-maps-from-top-to-bottom)
- [Web bundlers (e.g. Webpack)](https://craigtaub.dev/under-the-hood-of-web-bundlers)
- [Apollo](https://itnext.io/under-the-hood-of-apollo-6d8642066b28)
- [Type systems (e.g. TypeScript)](https://craigtaub.dev/under-the-hood-of-type-systems)

A video for this post can be found [here](https://www.youtube.com/watch?v=mMTYRijTHEo). A part of my ["under-the-hood of"](https://www.youtube.com/channel/UCYi23MnKBKn0yLZKBrz5Bfw) video series.

---

# React overview

We should start with a basic bare-bones version of React. To do that we need to touch on some of the core design concepts which React follows, such as:

## JSX

- Elements are POJO’s (plain-old-javascript-objects)
- Components are functions

## Pure rendering

- A instance of a render follows: Render = Component(Data)

## State machine

- One-directional data flow
- Data change detection forces updates for all children who need it

We are going to build our own (super simple) version of React and then add Hooks, to do that we need a basic version of the React engine which should render (log) a component with some props and return the component (for interacting with later).

```javascript
const React = {
  render: Component => {
    const exampleProps = {
      unit: "likes",
    }
    const compo = Component(exampleProps)
    console.log("Render: ", compo.inner)
    return compo
  },
}
```

Now we have a basic engine we need an accompanying component which returns the React element (object) during the render:

```javascript
const Component = props => {
  return {
    type: "div",
    inner: props.unit,
  }
}
```

We can now use our React and Component together and see its output (below each line of code):

```javascript
let App = React.render(Component) // render
// logs: render 'likes'
App = React.render(Component) // re-render
// logs: render 'likes'
```

So we now have a basic Component which is rendered by our React engine.

---

# React Hooks

A brief reminder about Hooks.

> "Hooks let you use state and other React features inside a pure component, without writing a class"

Classes would often confuse people and add bloat to your code, however there are other strengths to using Hooks some of which are:

- Easier to build and re-use stateful logic
- Easier to split components into relatable pieces
  -Removes confusion over the many lifecycle methods (i.e. what correlates to what event)
- No fundamental changes to your React knowledge, just a more direct way to use features you already know
- Easy to add types, as Hooks are just functions (unlike high-order components and most of the render props pattern)
- Easy to test with _"react-dom/test-utils"_

So it is easy to see why Hooks are such a powerful mechanism. So let’s examine how they work and build our own.

---

# The _useState_ Hook

There are a couple of core concepts with useState:

- Use state in pure component.
- Use any primitive (string/array/object etc.)

According to the docs they always return:

1. a reducer state
2. an action dispatcher

However this can be simplified into a basic property value and a setter.
There is a simple rule which is very important to Hooks. That is that **the Hooks are called at the top**. That means outside of any conditionals or nesting blocks. This is crucial to the Hooks mechanism and we will examine why.

So let us expand out React engine to include the useState Hook. We will need a "state index" counter, as well as "state store" for values.

```javascript
const React = {
  index: 0, // state index
  state: [], // state store
  useState: defaultProp => {
    const cachedIndex = React.index
    if (!React.state[cachedIndex]) {
      React.state[cachedIndex] = defaultProp
    }

    const currentState = React.state[cachedIndex]
    const currentSetter = newValue => {
      React.state[cachedIndex] = newValue
    }
    React.index++
    return [currentState, currentSetter]
  },
  render: Component => {
    const exampleProps = {
      unit: "likes",
    }
    const compo = Component(exampleProps)
    console.log("Render: ", compo.inner)
    React.index = 0 // reset index
    return compo
  },
}
```

We have also added a _useState_ method. It works by:

- Checking if the current index has a value in the state, if not set the default
- Then build the setter for the current state index value
- Finally increment the index (for the next Hook) and return the setter and current value.

Now we will make use of our _useState_ in our Component.

```javascript
const Component = props => {
  const [count, setCount] = React.useState(0)
  const [name, setName] = React.useState("Steve")

  return {
    type: "div",
    inner: `${count} ${props.unit} for ${name}`,
    click: () => setCount(count + 1),
    personArrived: person => setName(person),
  }
}
```

See the "count" and "name" usage above. Also we have utilised both inside the "inner" property so that we can spy on it in the terminal. Additionally we have added some manual methods to update the state values. They are manual as we are not worrying about the change detection or reconciliation in this post. We will be manually triggering the returned functions as well as the render method (following how we used it in our React engine section earlier).

So on running the below, we log the rendered output. We can see with each "click() "we are updating the count, and with "personArrived()" we are updating person (terminal output below line of code).

```javascript
let App = React.render(Component) // render
// render '0 likes for Steve'
App = React.render(Component) // re-render
// render '0 likes for Steve'
App.click()
App = React.render(Component) // re-render
// render '1 likes for steve'
App.click()
App.personArrived("Peter")
App = React.render(Component) // re-render
// render '2 likes for Peter'
```

There is 1 main issue in our usage. That is that this would NOT work for many components at the same time. It is very tightly coupled to our single component. The state should be held in module scope or a single store namespaced to the component.

---

# The _useEffect_ Hook

A short quote from the docs:

> "A function which runs after the initial render and after every update"

Similarly to _useState_, the rule about calling at the top-level applies. It is required for our implementation as well.

Couple of concepts for effects:

- Created during render
- Run in definition order (like _useState_)
- Run after a given lifecycle event (first render and/or when a dependency has changed. i.e. mount and update)
- Returns a function (some effects require cleaning e.g. unsubscribing)

Our _useEffect_ Hook mechanism is below:

```javascript
useEffect: (callback, dependencies) => {
  const cachedIndex = React.index;
  const hasChanged = dependencies !== React.state[cachedIndex];
  if (dependencies === undefined || hasChanged) {
    callback();
    React.state[cachedIndex] = dependencies;
  }
  React.index++;
  return () => console.log("unsubscribed effect");
},
```

A run-through of the code:

- Cache the store index
- Check if the dependency has changed in state (this is our variable tracking mechanism)
- If there is no dependency given or its changed, run our effect and update store index value with our dependency value
- Then increment the store index for future Hooks to use their own index
- Finally return a function

You can see the way that our effect Hooks also depend on the "state index". Similarly to _useState_, it relies on the deterministic order of values in the state array.

All state and effect Hooks must be called in the same order, so their state index can always be found in the same location in the state array.

Now lets update our component to use the effect Hook

```javascript
const Component = props => {
  const [count, setCount] = React.useState(0)
  const [name, setName] = React.useState("Steve")

  const exitThis = React.useEffect(() => {
    console.log("Effect ran")
  }, name)

  return {
    type: "div",
    inner: `${count} ${props.unit} for ${name}`,
    click: () => setCount(count + 1),
    personArrived: person => setName(person),
    unsubscribe: () => exitThis(),
  }
}
```

The above Hook will look for changes on the "name" property, also we have exposed an "unsubscribe" function for our effect Hook.

So now onto the running order during rendering, I have logged the state array with each render to help us follow (see below screenshot for the detailed explanation).

```javascript
let App = React.render(Component) // render
// state: [ 0, 'Steve' ]
// Effect ran
App = React.render(Component) // re-render
// state: [ 0, 'Steve', 'Steve' ]
// Effect does not run
App.click()
App = React.render(Component) // re-render
// state: [ 1, 'Steve', 'Steve' ]
// Effect does not run
App.click()
App.personArrived("Peter")
App = React.render(Component) // re-render
// state: [ 2, 'Peter', 'Steve' ]
// Effect ran

App.unsubscribe()
// "unsubscribed effect"
```

The below details what is happening above for our effect.

## First render

After 2 state runs the "cachedIndex" is now 2 inside of _useEffect_. The state value is "undefined" as it does not exist for that index (yet). So we will run our callback and write a new entity into state (under index 2), which is our dependency value (i.e. currently "Steve").

SO: state now has local state values and effect values. It is in a deterministic order based on the “state index” (i.e. where it is called in the component). This means it is reliable as this order should not change. Remember **Rule #1**.

## Re-renders

We will check the 3rd value in our state array and the effect will run only if it changes. See above our Hook runs again when we change the name to "Peter". Lastly we unsubscribe from our Hook.

There are 2 main issues with the above (among others):

### 1. Only works with 1 dependency, not an array.

It is easy to expand our code so we could use an array. By using the same store index and storing an array of dependencies on the state, not just single value. Then iterate over that dependency array to check for changes.

### 2. Ours is run before the render, not after

This is a more complex issue to fix and would require fundamental changes to our React engine. As this is a small POC example it is not worth fixing.

---

I hope this was useful or at the very least a little interesting. I very much enjoyed learning about Hooks and have a deeper appreciation for them as a feature which has helped move the front-end developer experience forward.
You can find a gist of the code [here](https://gist.github.com/craigtaub/a131eb23a9aa15540a84dc2266e1b672)
Thanks, Craig 😃
