---
name: interview-prep
description: Use when you need to prepare for a specific interview for a senior frontend position based on the text of a job posting, rather than for "frontend in general".
whenToUse: Parsing a job posting, self-checking on topics, practicing the answer format and the behavioral part 1-3 days before the interview.
---

# Preparing for a specific interview

The goal is not to "review frontend", but to close the requirements of one job posting with verifiable statements and numbers from your own experience. Technical terms are given in English because the interview may be conducted in English.

## 1. Parsing the job posting into a verifiable list

1. Write out all the requirements from the job posting text verbatim, separately the mandatory ones and the "nice to have".
2. Turn each requirement into a verifiable statement: not "I know React", but "I can explain reconciliation, keys, the rules of hooks, when memo hurts".
3. Mark three statuses: `have with numbers`, `have superficially`, `do not have`.
4. From the list, pick 5-7 topics that are simultaneously (a) mandatory in the posting, (b) asked most often, (c) your weakest. Everything else — just read aloud once, do not study.
5. For each chosen topic prepare: a one-sentence definition, 2-3 trade-offs, 1 example from experience, 1 way to verify by measurement.
6. For the `do not have` status decide honestly: either say "I have not worked with it, but I did X nearby, read Y, am ready to figure it out this way", or find adjacent experience, or drop the requirement and do not apply. You cannot invent experience — failing on a follow-up question is worse than a gap.
7. Create a notes file for one job posting: the list of requirements, 5-7 topics, 6-8 stories with numbers, 5 questions of your own.

## 2. Self-check on topics at senior level

For each topic, answer aloud, without peeking, for 2-3 minutes.

- **React**: render and reconciliation; why `key` is needed and why an index as key breaks state; the rules of hooks and why they are that way; concurrent capabilities (`useTransition`, `useDeferredValue`, tearing); Context and its cost (any render of the provider moves all consumers); when `memo`/`useMemo` hurt (extra complexity, a cache per render costlier than the computation); state vs derived data; Suspense and error boundaries; hydration, SSR/CSR/RSC and where the boundary lies.
- **TypeScript**: strictness (`strict`, `noUncheckedIndexedAccess`), generics and their constraints, type narrowing, type inference and when an annotation breaks inference, validating external data at the boundary (zod/valibot) instead of `as`.
- **Architecture**: module boundaries and the direction of dependencies, the data layer (requests, cache, invalidation), unified error handling, feature flags and their removal, where state lives.
- **Performance**: metrics (LCP, INP, CLS), how you measure (Lighthouse, Performance panel, `performance.mark`), the bundle budget, what you have already optimized and with what number.
- **Testing**: the pyramid, what is not worth testing (implementation, snapshots for coverage's sake), unit vs integration, e2e and its cost.
- **Browser and network**: HTTP cache and headers, CORS and preflight, XSS/CSP, accessibility.
- **Tooling**: build (Vite/webpack), monorepo, CI and what it checks before merge.

## 3. The answer format that sounds senior

The order is rigid:

1. The essence in one sentence.
2. Trade-offs and limits of applicability: when the approach works, when it does not.
3. A concrete example from your own experience.
4. "Here I would verify by measurement" or a counter-question about the conditions.

Bad: "It depends" without a continuation. If the answer depends, name on what and give the branches: "depends on the update rate: for 1-2 per second — ref, for dozens — rAF + batching".

Bad: enumerating without choosing. "There is Context, Redux, Zustand, Jotai" is not an answer. The answer: "I would take Zustand, because ..., I would not take Redux because of ...".

Keep the tempo: 60-90 seconds per answer, then a pause for questions.

## 4. Behavioral part

- The STAR frame: Situation, Task, Action, Result. Always name the result in numbers.
- Project: 2 minutes by STAR — the context, your role, what exactly you did, how it ended.
- Conflict: describe the other side's position without devaluing it, your argument, how you reached a decision, what you would do differently.
- Failure: only a real one, with a consequence and with what you changed in your process afterwards. "There were no failures" reads as a lack of reflection.
- "Why are you leaving": about growth, scale, technologies, without criticizing people or the company.
- "Why us": 2-3 facts from the posting and the product tied to your goals.
- Gaps: "I did little" → say it directly, name the closest experience and the plan.
- Your questions to the interviewer are part of the evaluation. Ask about code review, the release cycle, tests and quality, tech debt, product metrics, how decisions are made, what happens after a person leaves.

## 5. Practical assignment at the interview

Live coding:

1. Before the code — clarifying questions: input data, edge cases, constraints, result format.
2. The plan aloud: data structure, steps, complexity.
3. A simple working version, narrate it, check it by hand on an example.
4. Then improvements: optimization, types, tests, cleanliness. Improving before a working solution is a mistake.

"Find the bug in this code": say your hypotheses aloud, go through the data and the states, isolate the minimal case, name the cause and the fix. Do not rewrite the whole file.

Typical mistakes: staying silent while thinking; optimizing right away; arguing with the condition instead of asking a clarifying question; abandoning the solution at the first error; not checking the code on an edge input.

## 6. Strengths and weaknesses after 18 years of experience

- From each project pull out the scheme "what it was → what I did → what it became in numbers": build time, bundle size, conversion, number of bugs, review time, latency.
- Do not retell technologies as a list — they are proven by the result. "Worked with webpack" is weaker than "cut the build from 8 to 3 minutes by moving vendor into a separate chunk".
- If you did little: say directly what exactly, and what you propose instead — adjacent experience, a 30/60/90 plan, readiness for a narrower role.
- Prepare 6-8 stories, they cover 80% of behavioral questions.

## 7. Questions about AI at work

Tell it as a process, not as an attitude:

- which tasks you delegate (test drafts, routine refactoring, exploring an unfamiliar API, type generation);
- how you verify the result (tests, types, review, reading the diff line by line, measurement);
- which risks you see (hallucinations in APIs and configs, code leakage, licenses, reduced understanding of the code in the team, "it works, but nobody understands why").

Both extreme answers are bad: "I don't use it" looks like a refusal of the tool; "AI does everything for me" zeroes out your value. The right middle: "the tool speeds up the rough work, the responsibility and the final decision are mine".

## 8. The day before and on the day of the interview

- The day before: reread the 5-7 topics and the notes on the posting, say the 6-8 stories aloud, write out 5 questions for the interviewer, check the connection and sound (microphone, headphones, light, background).
- Remove everything that is not on the topic list — do not reread "just in case".
- On the day: 15 minutes before the start check the camera, sound, link, close extra tabs and notifications, keep the notes with the topic list and questions in front of you.
- Right after: record the questions where you stumbled, the wording, what worked, what to redo. This is the basis of the next preparation.

## 3-day preparation checklist

- [ ] Parse the job posting text, write out the mandatory requirements and the "nice to have"
- [ ] Turn the requirements into verifiable statements
- [ ] Mark the statuses: have with numbers / superficially / do not have
- [ ] Pick 5-7 topics for deep preparation
- [ ] For each gap decide: adjacent experience or honest admission
- [ ] Prepare 6-8 STAR stories with numbers
- [ ] Run through React aloud: reconciliation, keys, hooks, Context, memo, state vs derived
- [ ] Run through TypeScript aloud: strictness, generics, narrowing, data boundaries
- [ ] Run through architecture aloud: modules, data layer, errors, feature flags
- [ ] Run through performance aloud: metrics, measurement, bundle budget
- [ ] Run through testing and CI aloud: what to test and what not to
- [ ] Run through browser and network aloud: cache, CORS, security, accessibility
- [ ] Practice the answer format: essence, trade-offs, example, verification by measurement
- [ ] Prepare the answers: leaving, "why us", failure, conflict, gaps
- [ ] Prepare the answer about AI: what I delegate, how I verify, what risks
- [ ] Write out 5 questions for the interviewer
- [ ] Do one practice live-coding task with the plan aloud
- [ ] Check the connection, sound, camera and the meeting link
- [ ] After the interview record the debrief: where you stumbled, what to redo

## Preparation anti-patterns

- Cramming APIs and signatures without understanding why and what the trade-offs are.
- Studying everything in a row instead of the 5-7 topics from the posting.
- Answering with memorized wording without examples from experience.
- Not preparing questions for the interviewer.
- Not preparing examples with numbers, saying "improved performance" without figures.
- Inventing experience you did not have — it breaks on the first follow-up question.
- Retelling the stack instead of the results.
- Staying silent during live coding and rushing straight into optimization.
