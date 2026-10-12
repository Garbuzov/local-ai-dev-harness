---
name: frontend-perf-audit
description: Use when you need to measure and justify React application performance with numbers — Core Web Vitals, bundle, rendering, network — and produce a report with baseline, effect and cost of the fixes.
whenToUse: Auditing or speeding up a React application when you need metrics before and after, not opinions.
---

# React application performance audit

## 1. Order of work

1. Measure first, then change. No fix starts without a "before" number.
2. Record the baseline: build (commit hash), throttling profile (for example CPU 4x, Slow 4G), device, number of runs.
3. One experiment — one variable. Several fixes in a single commit make the effect unprovable.
4. After every fix, repeat the same measurement under the same conditions and record the result next to the baseline.
5. If the delta is smaller than measurement noise (for Lighthouse usually ±5-10 points, for lab metrics ±10%), treat the effect as unproven.
6. Every claim in the report must have a source: URL, file/line, screenshot or command output.

## 2. Metrics

| Metric | Good | Needs improvement | Poor | Type | How to measure |
|---|---|---|---|---|---|
| LCP | ≤ 2.5 s | 2.5-4.0 s | > 4.0 s | field + lab | CrUX, `web-vitals`, Lighthouse, DevTools |
| INP | ≤ 200 ms | 200-500 ms | > 500 ms | field (+lab via trace) | CrUX, `web-vitals`, DevTools Interactions |
| CLS | ≤ 0.1 | 0.1-0.25 | > 0.25 | field + lab | CrUX, `web-vitals`, Layout Instability API |
| TTFB | ≤ 800 ms | 0.8-1.8 s | > 1.8 s | field + lab | Server Timing, Network waterfall |
| TBT | ≤ 200 ms | — | > 600 ms | lab | Lighthouse, DevTools Performance |

- Lab (Lighthouse, DevTools Performance) — synthetic: reproducible, but not equal to real user experience.
- Field (CrUX, `web-vitals` in production) — real sessions: the truth about UX, but slow feedback (CrUX — 28 days).
- Work in pairs: lab finds the cause, field confirms the effect on users.
- TBT and long tasks (> 50 ms) are proxies for main-thread blocking; INP is measured only on real interactions.
- Subscribe `PerformanceObserver` to `longtask`, `largest-contentful-paint`, `layout-shift`, `event` (`durationThreshold: 16`) and log with `attribution`.
- INP replaced FID: FID measured only the delay to the first response and ignored processing and rendering; INP accounts for the full duration of the interaction and the worst (near-worst) case over the session.

## 3. Tools

- Chrome DevTools Performance: trace recording, main thread, long tasks, flame chart, Bottom-Up/Call Tree, Interactions, Layout Shifts. Always enable CPU/Network throttling and record marks (`performance.mark`) around the scenario under investigation.
- Lighthouse: gives an aggregate and hints, but is variable. Run it ≥ 3 times, compare the median, record the Lighthouse version and config (mobile/desktop).
- `chrome-devtools-mcp`: reproducible trace recording, reading console/network, stable measurements instead of screenshots — the preferred way for an agent, not "by eye".
- Bundle: `rollup-plugin-visualizer` or `source-map-explorer` on the production build; check `duplicates` with `pnpm why` / `npm ls`.
- Field: `web-vitals` (`onLCP`, `onINP`, `onCLS`, `onTTFB`) with `attribution` and sending to analytics; without this the production effect is unprovable.

## 4. Diagnosis by symptom

| Symptom | Likely cause | How to confirm | What to do |
|---|---|---|---|
| Long LCP | slow TTFB, render-blocking CSS/JS, hero image without `preload`, late start of loading | LCP breakdown trace (TTFB, load delay, load time, render delay), Network waterfall | cache/CDN, `preload`+`fetchpriority="high"`, AVIF/WebP with explicit dimensions, inline critical CSS |
| High INP | long tasks in handlers, heavy re-render, synchronous layout | DevTools Interactions + trace on click, `PerformanceObserver('event')` | split the task, `startTransition`/`useDeferredValue`, Web Worker, debounce |
| Shifting CLS | images/iframes without dimensions, late font, banners inserted above | Layout Shifts in the trace, `layout-shift` observer with `sources` | set `width`/`height` or `aspect-ratio`, `font-display`, reserve the space |
| Large bundle | no code splitting, duplicate dependencies, importing whole libraries | visualizer, `source-map-explorer`, `pnpm why` | dynamic import, `sideEffects: false`, granular imports, replacing heavy dependencies |
| Slow first render | synchronous work before and during the first render, request waterfall, hydration | React Profiler (commit duration), trace, `performance.measure` | move computations out, `Suspense`/streaming, parallel loads, server rendering |
| Jank on input | controlled input over a large list, re-render of the whole tree, synchronous parsing | trace, React Profiler, `why-did-you-render` | debounce, virtualization, `useDeferredValue`, memoization backed by measurement |
| Memory leak | unclosed subscriptions/timers/`AbortController`, growing caches, detached DOM | Heap snapshot ×2 + Comparison, Detached elements, Performance monitor | cleanup in `useEffect`, weak references, cache limits |

## 5. Loading

- Code splitting by route (`React.lazy` + `Suspense`) and by interaction (dynamic import in the handler for modals, editors, charts).
- Keep the initial chunk within a reasonable bound (guideline ≤ 170 KB gzip for the shell); everything else — on demand.
- Tree shaking: correct `sideEffects` in `package.json`, ESM build, named imports instead of `import * as`.
- Priorities: `modulepreload` for critical chunks, `preload` for fonts and the hero image, `prefetch` for the next route; do not `preload` everything — it competes for bandwidth.
- Fonts: self-host, `font-display: swap`, subsetting (`unicode-range`), only the weights you need; `preload` — only for the critical one.
- Images: AVIF/WebP, `srcset`+`sizes`, `loading="lazy"` below the fold, `decoding="async"`, always explicit dimensions against CLS.
- Critical CSS — inline, the rest asynchronously; watch that inlining does not bloat the HTML.

## 6. Rendering and interaction

- Prove extra re-renders with the profiler (React DevTools Profiler: "why did this render", `why-did-you-render`), not by reading the code.
- Stabilize references: `useCallback`/`useMemo`/memoized selectors — only for measured hot spots and problematic props.
- Long lists — virtualization (`react-window`, `@tanstack/virtual`); check the `key` and the absence of the index as a key when sorting.
- Expensive updates — `useTransition` (does not block input) and `useDeferredValue` (defers rendering of a heavy subtree).
- Split heavy computations (`requestIdleCallback`, frame-sized chunks) or move them to a Web Worker; the main thread must not compute for more than ~50 ms in a row.
- Debounce/throttle input (search, resize, scroll); do not run network and parsing on every keystroke.

## 7. Network and data

- Cache: `Cache-Control: public, max-age=31536000, immutable` for hashed assets, short TTL + `ETag` for dynamic content, a CDN in front of the origin.
- Protocol and compression: HTTP/2 or HTTP/3, brotli/gzip; check Network → Protocol.
- Deduplication: one caching layer (React Query/SWR) instead of duplicate `fetch` calls; the query key comes from the parameters.
- Parallelism: independent requests — at the same time (`Promise.all`), not chained.
- Waterfalls: lift loading into a route loader or the parent component, start the request before rendering children.
- Optimistic updates with rollback on error — instead of waiting for a response on every action.
- Pagination/cursor and payload limits; cancel requests via `AbortController` on unmount and on parameter change.

## 8. Report format

For each finding: `what` — `where` (file:line or URL) — `measured value` (baseline → target) — `expected effect` — `cost of the fix` (S/M/L) — `priority` (P0-P2).

- One report — no more than 5-7 items, sorted by effect-to-cost ratio.
- P0 — what moves LCP/INP/CLS for users and can be fixed in hours.
- Everything else — into the backlog with a link to the numbers, not into the current report.

## Audit checklist

- [ ] Target metrics and thresholds are agreed with the team.
- [ ] Baseline recorded: commit, build, throttling, number of runs.
- [ ] Field picture captured: CrUX or `web-vitals` from production.
- [ ] LCP, INP, CLS, TTFB, TBT and the number of long tasks recorded.
- [ ] A Performance trace with throttling recorded for the main scenario.
- [ ] LCP breakdown analyzed: TTFB, load delay, load time, render delay.
- [ ] Interactions analyzed: the most expensive handler found.
- [ ] Layout Shifts and their `sources` checked against CLS.
- [ ] Lighthouse run ≥ 3 times, the median recorded.
- [ ] Bundle analyzed: chunk sizes, duplicates, the heaviest dependencies.
- [ ] `preload`/`prefetch`/`modulepreload` and their priorities checked.
- [ ] Fonts checked: format, subsetting, `font-display`, preload.
- [ ] Images checked: formats, `srcset`/`sizes`, lazy, explicit dimensions.
- [ ] Re-renders profiled: components with the highest commit time found.
- [ ] List virtualization, `useTransition`/`useDeferredValue`, Web Worker checked.
- [ ] Network checked: cache headers, compression, protocol, waterfalls, request cancellation.
- [ ] Every fix re-measured with the same method and compared against the baseline.
- [ ] Report assembled: ≤ 7 findings with numbers, files/URLs, effect and cost.

## What not to optimize

- Premature memoization: `useMemo`/`useCallback` without a profiler add code and give no effect.
- Micro-benchmarks with no UX impact: `for` vs `map` over 100 elements moves nothing in Core Web Vitals.
- Rare paths and admin screens: they have no user-time budget, simplicity matters more.
- What is already within the threshold: taking LCP from 1.8 s to 1.6 s is not worth it — tackle the next problem from the top first.
- Abstractions and refactoring for "cleanliness": if it is not measurable, it does not count as an improvement.
- Swapping libraries without numbers: verify the kilobyte win in the built bundle, not in the README.
