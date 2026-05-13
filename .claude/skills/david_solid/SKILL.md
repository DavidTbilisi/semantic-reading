# Frontend Engineering Skill: HTML, CSS, JS, React, Vue, Next.js

Use this skill when writing, reviewing, refactoring, or designing frontend code.

## Mission

Produce frontend code that is:

- semantic
- accessible
- responsive
- maintainable
- component-based
- testable
- performant enough
- consistent with the existing project

Do not over-engineer. Prefer boring, readable code.

---

# Default Workflow

1. Inspect existing framework, file structure, naming, styling system, and conventions.
2. Identify the smallest change that solves the problem.
3. Prefer semantic HTML before JavaScript.
4. Prefer CSS/layout fixes before component rewrites.
5. Add or update tests for important behavior.
6. Check accessibility, responsiveness, and edge states.
7. Explain trade-offs briefly.

---

# Universal Frontend Rules

## HTML

Use semantic tags:

```html
<header>
<nav>
<main>
<section>
<article>
<aside>
<footer>
<button>
<form>
<label>
````

Avoid:

```html
<div onclick="...">
<span class="button">
<div role="button">
---

Use real controls first.

## Accessibility

Every interactive element must be keyboard usable.

Check:

* visible focus state
* correct labels
* usable tab order
* alt text for meaningful images
* empty alt for decorative images
* buttons for actions
* links for navigation
* no color-only meaning
* sufficient contrast
* form errors connected to inputs

Bad:

```html
<input placeholder="Email">
```

Better:

```html
<label for="email">Email</label>
<input id="email" name="email" type="email">
```

---

# CSS Rules

Prefer:

* layout with Flexbox/Grid
* reusable utility classes when project uses them
* component-scoped CSS when project uses it
* design tokens for colors/spacing
* logical properties when useful
* mobile-first responsive styling

Avoid:

* magic pixel positioning
* excessive `!important`
* deeply nested selectors
* global styles leaking everywhere
* fixed heights for dynamic content
* CSS that depends on fragile DOM structure

## Layout Priority

Use this order:

1. normal document flow
2. flexbox
3. grid
4. sticky
5. absolute positioning
6. JavaScript layout calculation

Absolute positioning is usually the last resort.

---

# JavaScript Rules

Prefer:

* clear names
* small pure functions
* event delegation when useful
* explicit state
* early returns
* predictable data flow

Avoid:

* global mutable state
* hidden DOM coupling
* anonymous complex callbacks
* duplicated selectors
* business logic inside event handlers
* unnecessary dependencies

Bad:

```js
document.querySelector(".btn").onclick = () => {
  // 60 lines
};
```

Better:

```js
button.addEventListener("click", handleSubmit);
```

---

# Component Design

Good components:

* have one clear responsibility
* receive data through props
* emit events/callbacks upward
* avoid hidden side effects
* handle loading, empty, error, and success states
* are easy to delete or replace

Bad names:

```txt
Manager
Wrapper
Container
Handler
Component
```

Better names:

```txt
CampaignCard
SignupForm
RedemptionStatus
UserMenu
PaginationControls
```

---

# React Rules

Prefer function components.

Use:

* `useState` for local UI state
* `useReducer` for complex local state
* `useMemo` only for expensive derived values
* `useCallback` only when referential stability matters
* custom hooks for reusable behavior
* controlled forms when validation matters

Avoid:

* storing derived state
* useEffect for simple calculations
* huge components
* prop drilling across many levels
* premature global state
* unnecessary memoization

Bad:

```jsx
useEffect(() => {
  setFullName(firstName + " " + lastName);
}, [firstName, lastName]);
```

Better:

```jsx
const fullName = `${firstName} ${lastName}`;
```

## React Component Checklist

Before finishing:

* props are minimal
* state is minimal
* effects are justified
* dependencies are correct
* rendering is predictable
* keys are stable
* forms are accessible
* edge states exist

---

# Vue Rules

Use Composition API unless the project uses Options API.

Prefer:

* `ref` for primitives
* `reactive` for grouped objects
* `computed` for derived values
* `watch` only for side effects
* props down, events up
* small composables for reusable logic

Avoid:

* mutating props directly
* large single-file components
* watchers for derived state
* mixing unrelated concerns in one component

Bad:

```js
watch([firstName, lastName], () => {
  fullName.value = firstName.value + " " + lastName.value;
});
```

Better:

```js
const fullName = computed(() => `${firstName.value} ${lastName.value}`);
```

---

# Next.js Rules

Respect the App Router model.

Prefer:

* Server Components by default
* Client Components only for interactivity
* server actions where appropriate
* route handlers for API boundaries
* `next/image` for optimized images
* metadata API for SEO
* streaming/loading states
* colocated `loading.tsx`, `error.tsx`, `not-found.tsx`

Avoid:

* making everything `"use client"`
* fetching client-side when server-side works
* leaking secrets to client components
* unnecessary API routes
* large client bundles

Rule:

```txt
If it does not need browser state, effects, or event handlers, keep it server-side.
```

---

# State Management

Use the smallest sufficient state layer:

1. local component state
2. parent state
3. URL/search params
4. context/provide-inject
5. lightweight store
6. full global state library

Do not use Redux/Pinia/Zustand/etc. unless the app actually needs shared state across distant components.

---

# Forms

Forms must handle:

* initial state
* validation
* submission
* loading state
* success state
* error state
* disabled state
* keyboard usage

Prefer native HTML validation where enough.

Use schema validation when rules are shared or complex.

---

# API/Data Fetching

Keep data fetching predictable.

Rules:

* isolate API calls
* handle loading/error/empty states
* validate external data when needed
* avoid duplicate requests
* abort/cancel stale requests when relevant
* never trust client-side validation alone

---

# Performance

Optimize only where there is evidence or obvious waste.

Check:

* unnecessary re-renders
* oversized bundles
* unoptimized images
* repeated expensive calculations
* layout shifts
* excessive client JavaScript
* slow third-party scripts

Do not cargo-cult memoization.

---

# Testing

Prefer:

* unit tests for pure logic
* component tests for UI behavior
* integration tests for flows
* E2E tests for critical paths

Test behavior, not implementation.

Good test names:

```txt
shows validation error when email is invalid
disables submit button while saving
renders empty state when no campaigns exist
```

Avoid testing private implementation details.

---

# Design Patterns for Frontend

## Container / Presentational

Use when separating data/loading logic from UI rendering.

## Compound Components

Use for flexible UI APIs like tabs, menus, accordions.

## Controlled Component

Use when parent owns value and validation.

## Uncontrolled Component

Use for simple native forms or refs.

## Custom Hook / Composable

Use for reusable stateful logic.

React:

```txt
useRedemptionForm
useDebouncedSearch
useOutsideClick
```

Vue:

```txt
useRedemptionForm
useDebouncedSearch
useOutsideClick
```

## Adapter

Use when normalizing backend/API/vendor data before UI uses it.

## Facade

Use when hiding complex frontend services behind one simple API.

---

# Code Review Output Format

When reviewing frontend code, respond with:

```txt
## Verdict
Good / Risky / Needs refactor

## Main Problems
1. ...

## Accessibility Issues
...

## Recommended Design
...

## Concrete Changes
...

## Tests to Add
...
```

---

# Final Rule

Start with semantic HTML, clean CSS, minimal state, and clear components. Add abstraction only when repetition or change pressure proves it is needed.

---

# Contract-First Testing Rule

Tests must be written before implementation.

The test is the contract.

Implementation is only correct if it satisfies the contract without weakening it.

---

## Workflow

1. Define expected behavior.
2. Write failing tests first.
3. Confirm tests fail for the right reason.
4. Implement the smallest code that passes.
5. Refactor only after tests pass.
6. Do not change tests to fit bad implementation.

---

## Contract Test Requirements

Every contract test should define:

- input
- user/action/event
- expected output
- expected side effect
- failure behavior
- edge cases

---

## Test-First Rule

Before adding functionality, create tests for:

- happy path
- invalid input
- empty state
- error state
- boundary cases
- permission/authorization if relevant
- async/loading behavior if relevant
- performance constraints if relevant

---

## Red-Green-Refactor

```txt
RED     write a failing test
GREEN   write minimum implementation
REFACTOR improve design without changing behavior
```

Do not skip RED.

---

## Frontend Contract Examples

### Component Contract

```txt
Component: SignupForm

Contract:
- renders email and name fields
- disables submit while saving
- shows validation error for invalid email
- calls submit handler with normalized data
- shows API error if submission fails
- is keyboard usable
```

### Hook Contract

```txt
Hook: useDebouncedSearch

Contract:
- does not search immediately
- searches after delay
- cancels previous pending search
- ignores stale results
- exposes loading/error/results state
```

### Service Contract

```txt
Service: CampaignExporter

Contract:
- exports selected campaign participants
- returns CSV Blob
- handles empty participants
- rejects unauthorized response
- preserves column order
```

### WASM Adapter Contract

```txt
Adapter: WasmSearchEngine

Contract:
- initializes WASM once
- indexes large text input
- returns deterministic ranked results
- falls back when WASM unavailable
- rejects malformed input safely
- does not block UI thread
```

---

## Rule for Claude Code

Before implementation, Claude must output:

```txt
## Contract
...

## Tests First
...

## Expected Initial Failure
...

## Implementation Plan
...
```

Then write the tests.
Only after tests exist should Claude write functionality.

---

## Forbidden Behavior

Do not:

* implement first and test later
* change tests just to make bad code pass
* delete hard tests without explanation
* mock the real behavior being tested
* use snapshot tests as the main contract
* test private internals instead of observable behavior

---

## Final Rule

If there is no failing test, the feature is not ready to implement.

```

