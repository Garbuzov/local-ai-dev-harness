---
name: react-review
description: "Use when reviewing React/TypeScript components or asking an AI agent to review them: a step-by-step checklist for state, hooks, render performance, component boundaries, UI states, accessibility, and typing."
whenToUse: "Reviewing a pull request or a single React + TypeScript component before merge."
---

# React component review

Check against the sections below. For every finding, report the file, the line, the replacement code, and the severity: blocker, improvement, style.

## 1. State and data

- Compute derived values in render, do not keep them in state.
- Store the minimum: `isDirty` instead of a copy of the form. Single source of truth: do not duplicate in `useState` what already exists in props or the cache.
- An object in `useState` only for atomic field updates; otherwise use separate values: a partial `setState` silently drops fields.
- Lift state to the nearest common ancestor of the consumers, not higher.
- Update by function when the new value depends on the previous one.

```tsx
// Bad: extra state and desync
const [items, setItems] = useState<Item[]>(props.items);
const [total, setTotal] = useState(0);
useEffect(() => setTotal(items.reduce((s, i) => s + i.price, 0)), [items]);

// Good: derived in render, functional update
const total = items.reduce((s, i) => s + i.price, 0);
const add = (item: Item) => setItems((prev) => [...prev, item]);
```

## 2. Hooks

- Calls only at the top level: no conditions, loops, nested functions; the number of calls is the same on every render.
- List `useEffect`/`useMemo`/`useCallback` dependencies in full; disable the linter only with a comment about the invariant.
- Cleanup is mandatory for subscriptions, timers, listeners, requests.
- A stale closure is cured by a functional update or `useRef`, and a `useEffect` for a value derived from props/state must be deleted and computed in render.
- `useLayoutEffect` only for measurements and synchronous DOM edits; subscribe to an external store via `useSyncExternalStore`, not via `useEffect` + `useState`.

## 3. Render and performance

- The list key is the stable id of the entity; the index as a key breaks state on insert, delete, sort.
- `memo`, `useMemo`, `useCallback` only after measuring in Profiler; wrap a child in `memo` only when all its props, including handlers, are stable.
- Context re-renders all consumers: split it into small contexts, keep primitives or a stable object.
- Move heavy initialization into `useState(() => compute())`, not `useState(compute())`.
- Inline objects and arrays in dependencies produce a new reference on every render — lift them out or into `useMemo`.
- Split a component that re-renders entirely because of a single field along the boundary of the changing data.

## 4. Component boundaries

- Props drilling deeper than two levels is a signal for composition or context, not for a third pass-through.
- Controlled keeps the value in the parent and does not mix it with internal `useState`; uncontrolled accepts `defaultValue` and reports changes via `onChange`; switching the mode at runtime is forbidden.
- `children` as a slot: the parent passes ready markup, the child is responsible only for layout.
- Type a polymorphic component with a generic and an `as` prop, not with a scatter of boolean flags.
- `forwardRef` only if the parent needs the DOM node; in React 19 `ref` arrives as an ordinary prop.
- Cancel async operations on unmount and on input change: `AbortController`, a flag in cleanup.

## 5. UI states

- Handle all four: loading, empty, error, partial; a spinner after a successful empty response is a defect, the empty state differs from loading.
- An optimistic update must have a rollback: save the previous value, restore it on error, show a notification.
- A render error is caught by an error boundary; a "white screen" is a defect, not default behaviour.
- `Suspense` for loading boundaries, `useTransition` so that a heavy update does not block input.
- The loading state does not cover already displayed data unless this is the initial load.

## 6. Accessibility and semantics

- Interactive elements are `<button>` or `<a>`, not `<div onClick>`; outside a form set `type="button"`.
- `role` and `aria-*` only where HTML semantics are insufficient; a redundant `aria-label` duplicates the visible text.
- A modal moves focus inside, traps it, and returns it to the trigger on close; `Esc` closes, `Tab` moves in a logical order, custom widgets handle the arrow keys.
- Fields are associated with `<label htmlFor>`; the error goes through `aria-describedby` + `aria-invalid`; icon buttons have an accessible name; do not remove `:focus-visible` without a replacement.

## 7. TypeScript in React

- `React.FC` is usually unnecessary: implicit `children` and problems with generics. Write `function Card(props: CardProps) {}`.
- Type props with an explicit interface, `children` as `React.ReactNode`, not `JSX.Element`.
- `any` is forbidden: use `unknown` with narrowing, a generic, or an exact type.
- `as` only with a comment, at the boundary with external data after validation; do not use `@ts-ignore`, `@ts-expect-error` only with a reason.
- Type handlers via `React.ChangeEvent<HTMLInputElement>` and related types.
- Describe state as a discriminated union (`{ status: 'loading' } | { status: 'error'; error: Error } | { status: 'success'; data: T }`) so that impossible combinations do not compile.

## Reviewer checklist

- [ ] Derived values are not in state, state is minimal and without duplicates.
- [ ] Updates that depend on the previous value go through a function.
- [ ] Hooks are called unconditionally, the number of calls is stable.
- [ ] Effect dependencies are complete, linter disables are explained.
- [ ] Every effect with a subscription, timer, request has a cleanup.
- [ ] No `useEffect` for values computed in render.
- [ ] The external store is connected via `useSyncExternalStore`.
- [ ] List keys are stable, the index is not used as a key.
- [ ] `memo`/`useMemo`/`useCallback` are justified by a measurement.
- [ ] Context does not re-render unrelated subtrees.
- [ ] Drilling is no deeper than two levels, boundaries are drawn along the data.
- [ ] The controlled/uncontrolled mode is unambiguous.
- [ ] Async operations are cancelled on unmount and on input change.
- [ ] loading, empty, error, partial are handled.
- [ ] An optimistic update rolls back on error; render errors are caught by an error boundary.
- [ ] Interactivity is semantic, focus and keyboard are verified, fields are associated with `label`.
- [ ] Types: no `any`, `as` is justified, states are unions, `React.FC` is not used.
- [ ] props are not mutated; state is not updated during render.

## Anti-patterns

- `useState` for a derived value → compute in render.
- `useEffect` + `setState` to sync with props → read props directly or use `key` to reset state.
- `key={index}` → `key={entity.id}`.
- Preventive `memo`/`useCallback` across the whole tree → measure and memoize hot paths selectively.
- `useEffect` to subscribe to an external store → `useSyncExternalStore`.
- `<div onClick>` → `<button type="button">`.
- Mixing controlled and uncontrolled in one component → one explicit mode.
- `any` and `as` to suppress type errors → `unknown` with narrowing or an exact model type.
