---
name: add-feature
description: Use when you add a new feature to this project — it defines the order of steps, file locations, mandatory checks, and change boundaries.
whenToUse: A request like "add feature X", "build screen Y", "we need a new capability".
---

# How to add a feature to this project

Project skill: it describes the procedure specifically for this template. Global rules
(language, stack, boundaries) live in `AGENTS.md`; do not duplicate them.

## Order of work

1. **Clarify the behavior before code.** What the user sees, which screen states are
   possible, what counts as success, what to do on error. If there isn't enough
   information, ask instead of guessing.
2. **Find where to integrate it.** A feature is a `src/features/<name>/` directory. If similar
   logic already exists in `shared/` or in another feature, reuse it, don't copy it.
3. **Design the state as a discriminated union.** The reference is
   `src/features/health/ui/HealthCheck.tsx`: `idle | loading | ready | error`,
   not a set of boolean flags.
4. **Model first, UI after.** Put the logic (pure functions, hook) in `model/`,
   the component in `ui/`. Logic without JSX is tested without rendering.
5. **Network access only through `src/shared/api/http.ts`.** Validate the response with a zod
   schema and infer the type from the schema: `const userSchema = z.object({...})`, `type User = z.infer<typeof userSchema>`.
   A direct `fetch` in a component is an error.
6. **Cancellation is mandatory.** Everything started from an effect gets an `AbortSignal`
   and unsubscribes in cleanup. A double call in StrictMode is normal.
7. **Write a behavior test.** At minimum: the happy path and the error state.
   The test checks what the user sees (roles, text), not the internals.
8. **Run the checks:** `pnpm check`. For UI changes, also `pnpm build`.
9. **Report honestly:** what was done, which files were touched, what was verified by running,
   what remains unverified.

## What goes where

| What | Where |
|---|---|
| Feature component | `src/features/<name>/ui/<Name>.tsx` |
| Hook or pure logic | `src/features/<name>/model/<name>.ts` |
| Feature requests and schemas | `src/features/<name>/api/<name>.ts` |
| Test | next to the file: `<Name>.test.tsx` or `<name>.test.ts` |
| Reusable without domain | `src/shared/lib/` or `src/shared/ui/` |
| New environment variable | `src/shared/config/env.ts` + `.env.example` |

## What not to do

- Do not wire up routing, a store, or a UI kit "along the way" — that is a separate decision
  and separate agreement.
- Do not change `package.json`, the lockfile, or CI.
- Do not add `any`, `@ts-ignore`, or `as` to bypass types.
- Do not leave `console.log` or temporary code (a lint rule catches this).
- Do not rewrite other people's files "while you're at it": the diff must contain only the feature.

## Definition of done

- `pnpm check` is green, `pnpm build` succeeds.
- The new behavior is covered by a test that fails if the behavior is removed.
- No type is weakened and no lint rule is disabled.
- `AGENTS.md` has no contradictions left with what was done (if the feature changes
  conventions — update the file in the same change).
