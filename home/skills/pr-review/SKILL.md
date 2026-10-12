---
name: pr-review
description: "Use when reviewing a pull request of any codebase or asking an AI agent to review a diff: review order, severity labels, risk edges, tests, diff hygiene, review report format."
whenToUse: "Process review of a PR — from reading the diff to the final report and replies to the author."
---

# Pull request review

A review is a check of a change for risk, not a retelling of the code. Analyze React components with the `react-review` skill; here is the process for an arbitrary repository.

## 1. Review order

Go top to bottom, do not skip around: each next level is cheaper to redo while the previous one is not confirmed.

1. **Goal and size.** Read the description and the linked task. State in one sentence what the PR does and what it must not do. If the sentence does not come together, that is already a blocker: the scope is unclear. A diff of more than ~400 lines of meaningful changes reviews badly in principle; ask to split it along its axes (refactoring separately, behavior separately).
2. **Public contract.** API endpoints, props, validation schemas, data formats, events, package exports, migrations. This is the most expensive: a contract change breaks consumers that are not in the diff. Check backward compatibility first, then the logic.
3. **Logic.** Control flow, boundaries, errors, state, concurrency. This is where real defects are found.
4. **Tests.** Whether they exist, what exactly they check, whether they fail when the fix is rolled back.
5. **Style.** Last and minimally: it does not affect behavior, and arguing about it eats the attention that logic and contract need.

Style must be caught by the linter/formatter/CI, not by a human. If style is being discussed in comments, the problem is in the tool configuration, not in the author. Human style review is also non-reproducible: different reviewers demand different things, and the author cannot objectively close the remarks.

## 2. Review boundaries

- Review the **change**, not the author. The wording "you forgot again" is not a technical argument.
- Do not demand a rewrite of what is not part of the PR. If you see someone else's debt nearby, file it as a separate task (`suggestion:`, link to a new ticket).
- Separate the levels and mark them explicitly in the comment text:
  - `blocking:` — a defect, a regression, a security hole, a broken contract. Without this it cannot be merged.
  - `question:` — you did not understand the intent; possibly there is no defect. Ask before drawing conclusions.
  - `suggestion:` — a workable improvement, not required to merge.
  - `nit:` — a matter of taste or a micro-improvement. The author may reject it.
- One level — one comment. Do not hide a blocker inside a long list of nits: it will get lost.
- Do not turn a review into a redesign: if the architecture is workable overall, propose a minimal fix within it, not "let's rewrite with a different approach".

## 3. What to look for substantively

**Boundaries and errors.** Empty data, `null`/`undefined`, empty array, missing field; network error, timeout, 4xx vs 5xx, retries and their cost; partial response, truncated JSON. External data (API response, `localStorage`, query parameters, postMessage) is validated, not cast through `as`. The error is not swallowed: empty `catch`, `void promise` without `.catch`, a lost exception in `Promise.all`.

**Concurrency and races.** A stale response overwrites a fresh one — a cancellation of the previous request is needed. Mutable shared state across several consumers, `await` between read and write. Double execution: repeated click, `StrictMode`, a repeated `effect`.

**Contract.** Response format, field name, type or default behavior changed without a migration, version or default. A public export removed or narrowed; the side effects of a function called from outside changed. Migrations: rollback, nullable fields, compatibility of old and new code at the moment of deploy.

**Resources.** Timers, intervals, listeners, subscriptions without cleanup; a socket, a worker, `ResizeObserver`/`IntersectionObserver` not closed; instead of `AbortController` — "let's forget about the result". Cache and memoization without a size limit and invalidation.

**Security.** `dangerouslySetInnerHTML`, `innerHTML`, rendering user HTML/Markdown without sanitizing. Secrets, tokens, keys, internal URLs in code, tests, fixtures, logs; `NEXT_PUBLIC_`/`VITE_` on something that must stay on the server. Trust in input: authorization is checked on the server, not by hiding a button; a resource id does not grant access to someone else's object (IDOR). Open links: `target="_blank"` without `rel="noopener noreferrer"`, `javascript:` and `data:` in URLs from user data, substituting values into queries and templates without escaping.

**Performance.** Only by measurement: profile, bundle size, number of requests, metrics. "It seems slow" is not a finding. Look for N+1 requests, missing pagination and limit, heavy work on the hot path, a bundle regression without justification.

**Accessibility.** Interactive elements are a real button or link; focus is not lost and not trapped; fields have labels, icon buttons have accessible names; the keyboard path works end to end.

**i18n and copy.** A new string is not hardcoded when i18n exists; pluralization and interpolation are not glued together from pieces; the error text is understandable to the user.

**Compatibility.** Browser APIs without a fallback and polyfill; accessing `window`/`document` outside an effect breaks SSR; markup mismatch during hydration; the Node version in CI.

## 4. Tests

- New behavior has a test; a fixed bug has a test that **fails** on the old code (verify this mentally or locally).
- The test checks behavior (input → observable result), not implementation (calls to internal methods, private fields, a snapshot of the whole tree for no reason).
- No "ever-green" tests: without assertions, with a trivially true expectation, with a stub of the module under test.
- No `skip`/`only`/`todo`, commented-out tests, or test files disabled in the config.
- Existing tests are not weakened or rewritten for the new behavior where behavior changed rather than expectations.
- Mocks do not replace the subject under test; fixtures contain no real data and no secrets.

## 5. Working with the diff

- Read `git diff` with enough context (`git diff -U10`, `git diff --stat`, `git log -p`), not just the hunks from the web interface: the reason for the change is often in the lines above.
- Analyze deleted code as carefully as added code: a removed check, cleanup or error-handling branch is a silent defect.
- Check the lockfile and configs separately: a dependency update, a Node version change, a CI edit, `tsconfig`, eslint, `Dockerfile`. A CI change in a feature PR is a reason to ask why.
- Look for the accidental: reformatting of whole files, reordered imports, debug code (`console.log`, `debugger`, commented-out code), leftover note comments, temporary fixtures, the appearance of `.env*` or keys, changes to file permissions and line endings.
- Compare the diff with the PR description: changes outside the stated goal are either a separate PR or an explicit justification.

## 6. Comments

- Be specific: **what exactly is wrong** (with a line reference), **why it matters** (which scenario breaks), **what you propose**. "This is kind of sloppy" is not a comment.
- Refer to a project rule or canon (ADR, lint rule, docs), not to personal preference.
- If unsure, ask a question rather than assert. Say openly "I don't know this area" if the context is outside your zone: that is cheaper than a false blocker.
- No sarcasm, rhetorical questions or judgments of the author. One comment — one topic.
- Praise what is done non-obviously well if it helps reinforce the practice — but do not turn it into a ritual.

**Replies to remarks on your own PR:** answer on every point (accepted/rejected with a reason/question), fix the code or explicitly record the refusal; take the contentious part to a discussion with a third participant, not into an endless thread. Expanding the task during review is a new task, not an edit of this PR.

## 7. Review by an agent

- The request to the agent contains four things: **which files/diff range**, **which criterion** (security, boundaries, concurrency, contract), **the response format**, **what not to do** (do not refactor, do not rewrite the architecture, do not change files).
- Require a list of lines in the form `file:line — problem — why it matters — what to do`, sorted by priority. Only such a format is verifiable: it can be checked line by line against the code.
- Always add: "mark uncertainty explicitly", "do not invent nonexistent code", "do not propose rewriting everything the right way".
- Run the agent with one criterion per pass: a broad request "find all problems" produces a lot of noise and few verifiable findings.
- **Check for false positives**: the agent confidently references lines that do not exist and proposes fixes that break an invariant or ignore existing protection higher in the stack. Open every finding in the code and confirm it before publishing it in the PR.
- The agent is not a replacement for reading the diff yourself: it speeds up the search, but the reviewer makes the decision about a blocker.

## 8. Final report

Write one report in the PR, not a stream of replies:

1. **Summary:** what you understood about the PR, which behavior changes.
2. **Blockers:** a numbered list with `blocking:` and references to file/line.
3. **Improvements:** `suggestion:`/`nit:` one level below, not mixed with blockers.
4. **What was checked:** the diff read, the tests/build/lint run, the scenarios reproduced.
5. **What was not checked:** uncovered areas, environments, roles, data — explicitly, so the author does not consider checked what was not looked at.

Verdict: `approve` only when there are no blockers; otherwise `request changes` indicating which items are mandatory.

## Full review pass checklist

- [ ] The PR goal is clear in one sentence; the scope matches the description.
- [ ] The diff is read in full, with context, not from individual hunks.
- [ ] Public contract changes are marked, there is a migration or backward compatibility.
- [ ] Boundaries: empty data, `null`, network error, timeout, partial response.
- [ ] External data is validated, not cast through `as`.
- [ ] Races: stale responses and repeated runs do not overwrite state.
- [ ] Resources are released: timers, subscriptions, listeners, `AbortController`.
- [ ] Errors are handled and not lost in promise chains.
- [ ] Security: XSS, HTML sanitizing, secrets, trust in input, open links.
- [ ] Performance is justified by measurement, not by taste.
- [ ] Accessibility: semantics of interactive elements, focus, labels, keyboard.
- [ ] Copy and i18n: no hardcoded strings, pluralization is correct.
- [ ] Compatibility: browsers, SSR, hydration, Node version.
- [ ] There is a test for the new behavior and a test that fails on the old code.
- [ ] Tests check behavior, there is no `skip`/`only` and no ever-green checks.
- [ ] The lockfile and configs are reviewed, CI changes are explained.
- [ ] There are no accidental changes or debug code.
- [ ] Every comment is marked with a level and says what to do.
- [ ] The report has a summary, blockers, improvements and "what was not checked".

## Red flags in a PR

- A large diff mixing refactoring, renames and new behavior.
- Changes in CI, Dockerfile or build config without an explanation in the description.
- Disabled, skipped or deleted tests along with a logic change.
- "Temporary" workarounds and `TODO` without a link to a task.
- Secrets, tokens and real data in code, tests or fixtures.
- Editing the lockfile by hand or a mismatch with `package.json`.
- `as`, `any`, `@ts-ignore`, disabling lint rules for no reason.
- The public contract changed without a migration and without a mention in the description.
- Empty `catch`, `void promise`, `console.log` on the hot path.
- Comments as discussion instead of a list of findings: a review without a verdict.
