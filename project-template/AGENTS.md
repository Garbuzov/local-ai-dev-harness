# AGENTS.md — <project name>

Template: copy it to the project root and replace everything in `<...>`. This file is read by
the agent in addition to the global `~/.dsh/AGENTS.md` and takes precedence over it.
Write here what the agent cannot infer from the code in reasonable time.

## What this project is

<One or two sentences: what the product does, for whom, in what state (prototype / production).>

## Stack and versions

- Runtime: Node <version>, pnpm <version>
- Frontend: <React 19 / Next 15 / ...>, build <Vite / Next / ...>, routing <...>
- Styles: <CSS Modules / Tailwind / vanilla-extract / ...>
- State: <TanStack Query / Zustand / Redux Toolkit / ...>
- Forms and validation: <react-hook-form + zod / ...>
- Tests: <vitest + Testing Library + MSW>, e2e: <Playwright / none>
- Backend: <Fastify / Next API routes / separate service>, DB: <...>

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # dev server, http://localhost:<port>
pnpm build            # production build
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest run
pnpm test:watch       # vitest in watch mode
```

Mandatory minimum before reporting readiness: `pnpm typecheck && pnpm lint && pnpm test`.

## Structure

```
src/
  app/          <routing, layout, providers>
  features/     <features: ui + model + api, one folder per feature>
  shared/       <ui kit, utilities, types, api client>
  pages/        <pages>
```

Import rules: `<who may import whom, whether there are @/... aliases and a ban on deep imports like ../../..>`

## Project conventions

- <File naming: PascalCase for components, kebab-case for the rest>
- <Exports: named, default only for pages/routes>
- <CSS: modules next to the component / tokens in ...>
- <Working with the API: only through src/shared/api, direct fetch in components is forbidden>
- <Server state: TanStack Query, keys in ...>
- <Error handling: Result type / throw AppError / error boundary>
- <i18n: strings only through t('...'), literals in JSX are forbidden>
- <Accessibility: interactivity — button/a, mandatory aria-* for ...>

Full stack conventions: the `react-review` skill (review) and `ts-strict-audit` (types).

## Gotchas and pitfalls

<What is not obvious: why it was done this way, what must not be broken, which known
problems and workarounds exist, what requires synchronization with backend/design.>

## Boundaries

- Do not change `<package.json` versions / lockfile / CI / DB migrations> without explicit agreement.
- Do not touch `<legacy/`, `src/generated/`> — generated/under maintenance.
- Do not commit without a request. Branches: `feat/<...>`, `fix/<...>`.
