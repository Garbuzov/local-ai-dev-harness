# AGENTS.md — frontend-app

This is a project template. The file is filled in for a specific stack rather than left as a
stub: it serves both as a working config and as an example of what to write in one.

## What this project is

An SPA skeleton on React + TypeScript: strict types, tests, lint, CI. There is no product
logic — there is one example feature (`counter`) and one example of network access (`health`).

## Stack and versions

- Runtime: Node >= 22.12, package manager pnpm 10.
- Frontend: React 19, Vite build, routing not wired up yet.
- Styles: plain CSS (`src/app/styles.css`); decide separately as the project grows.
- State: React local state; server state through `src/shared/api/http.ts`.
- Boundary validation: zod.
- Tests: Vitest + Testing Library, jsdom environment.
- Lint: ESLint flat config + typescript-eslint (type-aware).

## Commands

```bash
pnpm install            # install dependencies
pnpm dev                # dev server, http://localhost:5173
pnpm build              # typecheck + production build
pnpm preview            # preview the built version
pnpm typecheck          # tsc --noEmit for the app and for the Vite config
pnpm lint               # eslint
pnpm lint:fix           # eslint with autofix
pnpm test               # vitest run
pnpm test:watch         # vitest in watch mode
pnpm check              # typecheck + lint + test — mandatory minimum
```

Run `pnpm check` before reporting readiness. For UI changes, additionally `pnpm build`.

## Structure

```
src/
  app/                     application assembly: App, styles, providers
  features/<feature>/
    ui/                    feature components
    model/                 feature hooks and logic
    api/                   feature requests and schemas
  shared/
    api/http.ts            typed client: it is the only one that calls fetch
    config/env.ts          environment variable validation at startup
    lib/                   utilities with no domain knowledge
    ui/                    reusable components
  test/setup.ts            test environment setup
```

Import rules:

- The `@/` alias points to `src/`. Deep relative paths like `../../..` are forbidden.
- Dependency direction: `app` → `features` → `shared`. Reverse imports are forbidden.
- One feature does not import the internals of another; shared code is lifted into `shared`.

## Project conventions

- Components are `PascalCase.tsx` files, one exported component per file.
- Hooks are `camelCase.ts`, the name starts with `use`. Hooks without JSX live in `model/`.
- Exports are named. `default export` only where a tool requires it.
- Props are described by `interface <Name>Props` with `readonly` fields.
- Screen state is a discriminated union (`{ kind: 'ready', data }`), not a set of flags
  (`isLoading`, `isError`, `data`). Example — `src/features/health/ui/HealthCheck.tsx`.
- External data arrives as `unknown` and is validated by a zod schema; the type is inferred from the schema.
- `fetch` is called only inside `src/shared/api`. Components and hooks go through it.
- `any` is forbidden (lint rule). For "unknown" use `unknown` plus narrowing.
- Secrets only through environment variables. Keys never end up in code, commits, or tests.
- Interactivity uses `<button>`/`<a>`, not `<div onClick>`. Async operations are cancelled
  via `AbortController`, effects always return a cleanup.

## Gotchas and pitfalls

- `exactOptionalPropertyTypes` is enabled: an optional property cannot be explicitly filled
  with `undefined`. Either don't pass it, or change the type to `T | undefined`.
- `noUncheckedIndexedAccess` is enabled: `array[0]` has type `T | undefined`.
- ESLint works with type information, so a new file outside `tsconfig.json`
  will break `pnpm lint` with a parser error. Add the file to `include` or to `tsconfig.node.json`.
- `AbortSignal.any` requires Chrome 116+ / Node 20.3+. If older browser support is needed,
  replace it with manual signal composition.
- StrictMode runs effects twice in dev: the double request in `HealthCheck` is expected
  behavior, not a bug.

## Boundaries

- Do not change versions in `package.json` and do not touch `pnpm-lock.yaml` without agreement.
- Do not change `.github/workflows/ci.yml`. If a new step is needed, propose it, do not implement it.
- Do not commit or push without a request. Branches: `feat/<...>`, `fix/<...>`.
- Do not add dependencies without discussion: propose first, with justification.

## How to add a feature

The step-by-step procedure is in the project skill `.dsh/skills/add-feature/SKILL.md`.
