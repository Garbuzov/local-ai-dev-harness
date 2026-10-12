---
name: browser-debug
description: Use when you need to find the root cause of a frontend bug in the browser — reproduction, localization with DevTools, hypothesis verification and closing the bug with a regression test.
whenToUse: The bug reproduces in the browser, and you need to establish the cause rather than guess a fix by trial and error.
---

# Systematic frontend debugging in the browser

The order is fixed: **reproduce → localize → prove the cause → fix → verify → close**. Any code change before a hypothesis is stated is a lottery, not debugging.

## 1. Discipline

1. Reproduce the bug before making changes. No reproduction — no debugging, only guesses.
2. State the hypothesis in words: "X breaks because of Y, this is visible via Z". If Z cannot be checked, the hypothesis is worthless.
3. Decide how to verify **before** the change: breakpoint, `console.log` at a specific point, Network request, trace, test.
4. One experiment — one variable. Two changes at once make the result uninterpretable.
5. "Let me change it and see" is forbidden. Made a change — explain exactly what and what signal you expect.
6. Keep a short log: hypothesis → check → result → conclusion. Commit only after the cause is proven.
7. Do not trust your memory of the code: read the current file, not the one from a week ago.

## 2. Reproduction

- Minimal case: reduce the steps to three or four, remove extra data and roles. Break it again from scratch in a clean tab.
- Stability: **always**, **sometimes**, **only in prod**. "Sometimes" means a race, load order, cache or timezone; record the frequency (`10 out of 10`, `1 out of 20`).
- Environment: browser and version, dev or production build, enabled extensions, private mode, auth and role, cache and service worker state, locale and timezone, window size.
- Does not reproduce for you — change one thing at a time: the same data (a copy of the API response), the same account and permissions, the same build, the same headers, the same network (throttling), the same timezone.
- The "works on my machine" mismatch most often means different data, different feature flags or a different order of operations.

## 3. Tools and what to inspect with them

**Console.** Levels and filters (`error`, `warn`, `info`), `console.table` for arrays and objects, `console.count`/`time`/`group` for repeated calls, Preserve log during navigation, `console.trace()` for the call path. Clicking the stack in an error leads to the source if the source maps are valid; "the stack leads into the bundle" means the source maps are broken or disabled.

**Sources.** Line breakpoints, conditional breakpoints (`user.id === 42`) instead of log spam, `debugger` as a temporary stop, watch expression, call stack and Scope (Local/Closure/Global) — look at the actual value, not the assumed one. Step over/into/out to walk through the logic. XHR/fetch breakpoints and Event Listener Breakpoints — when it is unclear who even initiates the request or the handler.

**Network.** Status and timing (DNS, TTFB, content download), Request payload and headers, Response, Initiator (who called the request), "Save all as HAR" for sharing and analysis, throttling to check races and timeouts, request cancellation, `Disable cache` and `from disk cache`/`304`. Separately — the preflight `OPTIONS` under CORS and the failure reasons: no `Access-Control-Allow-Origin`, credentials without `Access-Control-Allow-Credentials`, a custom header.

**Application.** Cookies (`HttpOnly`, `Secure`, `SameSite`, expiry), localStorage/sessionStorage (keys, stale values), IndexedDB, service worker (update, `skipWaiting`, stale cache), Cache Storage, Clear storage as a quick environment reset.

**Performance.** Long tasks (> 50 ms), layout thrashing (alternating geometry reads and style writes), re-render causes, dropped frames during scrolling and typing. Look at Interactions and Bottom-Up, not only the flame chart.

**Elements.** Computed styles (the actual value, not what is in the authoring), Box Model and layout, `Styles` with crossed-out rules, the Accessibility tree, the layer tree. Check the winning rule by specificity and layer order.

## 4. Symptom categories and typical causes

| Symptom | Check first |
|---|---|
| White screen | Runtime error in Console; build error; unregistered route; crash in an error boundary; hydration failure |
| Click does not work | The wrong element catches the event; `preventDefault`/`stopPropagation` above; no handler attached; an overlapping layer; `pointer-events: none`; an exception in the handler |
| Data does not arrive | Method and URL; CORS; serialization of `Date`/`Map`/`BigInt`; 401/403; request race; cache; a stale response that was not cancelled |
| State is out of sync | Stale closure; double effect invocation; optimistic update without rollback; two sources of truth |
| Styles are not applied | Specificity; CSS layer order; scoped/inline; the wrong container; flex/grid alignment; overflow |

For a white screen, start with the stack of the first error, not with the component code. For "click does not work", first check in Elements which element is at the click point, then look for handlers in Event Listeners.

## 5. React-specific techniques

- React DevTools → Components: props/state of the selected component, owners, "why did this render" in the Profiler (props, state, parent, context change).
- Profiler: record an interaction, rank by render time; check not "how many renders" but "which render is expensive and why".
- StrictMode in dev invokes effects twice — distinguish a real race from a double invocation; the logic must be idempotent.
- `key` and lost state: a wrong `key` (array index) reuses the state of the wrong element; changing `key` unmounts the subtree.
- Hydration mismatch: divergence between server and client output (`Date`, `Math.random`, `typeof window`, locale) — look at the warning and the specific node.
- Suspense and error boundaries: a crash inside a boundary is not visible in Console without `componentDidCatch`/`onError`; check whether the boundary swallows the error.
- `useEffect` without cleanup: timers, subscriptions, unclosed requests. Verify any async response for relevance (AbortController or a cancellation flag), otherwise it is a race.
- Make sure the component renders at all: `debugger` or a breakpoint in the component body. An empty Scope at a breakpoint means the code never executed.

## 6. Working through the chrome-devtools MCP

When the Chrome DevTools MCP server is connected, the agent looks into a **real browser** — therefore only a test profile and test data.

Delegate: open the page and reproduce the scenario step by step; capture the console and network; record a performance trace; take a screenshot and capture a DOM snapshot; check the values in storages; run the same scenario before and after the change.

Do not delegate: production accounts and personal sessions, prod data, payments and irreversible operations, entering real secrets, any actions that modify user data. If a login is needed — a test user with limited permissions.

## 7. Finishing the debugging session

- Remove temporary `console.log`, `debugger`, commented-out code and leftover breakpoints.
- Record the cause in the commit message or a comment: what was broken and why, not "fix bug".
- Add a regression test for the specific case: it must fail before the fix and pass after.
- Verify on a build, not only in dev: production build, minification, source maps, another browser.
- Make sure nothing nearby broke: run the neighbouring scenarios and the tests of the affected module.
- Clean up after yourself: test data, created records and enabled feature flags.

## Checklist: from symptom to closing the bug

- [ ] The bug is reproduced from scratch in a clean tab.
- [ ] Steps, environment, build version and reproduction frequency are recorded.
- [ ] The first error in Console is read in full, with the stack.
- [ ] It is verified that the source maps are valid and the stack leads to the source.
- [ ] A minimal case is assembled (data, role, screen).
- [ ] A hypothesis about the cause is stated in words.
- [ ] A way to verify the hypothesis before the change is defined.
- [ ] Network requests are checked: URL, method, status, payload, response, initiator.
- [ ] The state of storages and the service worker is checked.
- [ ] Computed styles and the element under the cursor are checked (for visual bugs).
- [ ] For React: props/state in DevTools and the render cause are checked.
- [ ] Effect cleanup and cancellation of async responses are checked.
- [ ] The cause is proven, not confirmed by correlation.
- [ ] The fix is minimal and changes exactly one thing.
- [ ] Temporary logs, `debugger` and breakpoints are removed.
- [ ] A regression test that failed before the fix is added.
- [ ] Verified on a production build in another browser.
- [ ] Verified that neighbouring scenarios are not broken.
- [ ] The cause is recorded in the commit or a comment.
- [ ] Test data and feature flags are cleaned up.

## Rules that save hours

- Do not change more than one thing at a time.
- Trust the data from the tools, not intuition and memory of the code.
- After the change, verify that the error has changed: the same message means the cause is different.
- Read the first error in the console, the rest are often its consequences.
- If the hypothesis is not confirmed, discard it entirely; do not carry a partial explanation further.
- Do not debug on a production build what is easier to reproduce in dev, and vice versa: some bugs live only in one of them.
- Log data, not guesses: `console.log({ value, state })`, not `console.log('here')`.
- Separate "the bug does not reproduce" from "the bug is fixed" — these are different states.
