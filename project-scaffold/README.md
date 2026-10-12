# frontend-app

SPA template: React 19 + TypeScript (strict mode) + Vite + Vitest + ESLint + CI.

## Quick start

```bash
pnpm install
cp .env.example .env    # Windows: Copy-Item .env.example .env
pnpm dev
```

App: http://localhost:5173

## Checks

```bash
pnpm check      # typecheck + lint + test
pnpm build      # the same plus a production build
```

## What's inside

```
src/
  app/                 App, styles
  features/counter/    example feature: logic in model/, component in ui/, test next to it
  features/health/     example of network access and discriminated state
  shared/api/http.ts   typed HTTP client with schema response validation
  shared/config/env.ts environment variable validation at startup
  test/setup.ts        jest-dom setup
```

## Conventions

All project rules, commands, and boundaries are described in `AGENTS.md` — that file is
read by both a human and an agent. Start there if you take the template into work.

## What is deliberately not wired up

Routing, a server state manager, a UI kit, code formatting, e2e tests.
These are decisions of a specific project; adding them to the template "just in case" is harmful.
