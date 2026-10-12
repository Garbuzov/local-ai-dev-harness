---
name: node-api-scaffold
description: Use when scaffolding or auditing a Node.js + TypeScript backend service — directory layout, config via zod, errors, observability, tests and CI on pnpm.
whenToUse: Use when creating a new backend service or reviewing an existing Node/TypeScript API.
---

# Node.js + TypeScript backend: service skeleton

For a frontend developer moving into fullstack: Node 22/24, ESM, pnpm.

## 1. Stack

Base: Node LTS (22/24), TypeScript, ESM (`"type": "module"`), `tsx` for dev, `tsc` for builds, `pnpm`, `vitest`, `zod`. In Node 22+ these are built in and remove dependencies: `--watch` (dev restart), `fetch` and `AbortSignal.timeout()` (instead of `axios`), `node:test` (instead of `jest`), `node:sqlite` (instead of `better-sqlite3`).

Framework: **Fastify** — the default for JSON APIs (schemas, `app.inject()` without a port, pino); **Hono** — edge/serverless, Bun and Workers; **Express** — legacy context, weaker on types and speed; **`node:http`** — webhooks, health, proxies or one or two routes. One stack branch per project; below — Fastify.

## 2. Structure

```text
src/
  server.ts # listen, graceful shutdown
  app.ts    # instance assembly, no listen
  config.ts # env validation via zod, fail fast
  routes/   # HTTP: parse the request, call the service, respond
  services/ # business logic and transactions, no req/res
  repos/    # database and external APIs, queries only
  lib/      # errors.ts (AppError), logger.ts (pino, request-id)
test/       # unit and integration tests
```

Dependencies point downward only: `routes → services → repositories`; `app.ts` assembles them and passes them into services, shared types live in `src/types.ts`.

## 3. Configuration and secrets

- `process.env` is read only in `config.ts`; secrets come from env and CI secrets, never from code or compose files.
- `.env` locally and in `.gitignore`, `.env.example` in the repository with no values.
- Fail fast: a broken env crashes the process at startup, not an hour later at runtime.
- Build config (`tsconfig`, CI) is separate from runtime (environment env); the build does not depend on secret values.

## 4. Errors

- `AppError` with `code`, `httpStatus`, `message` (client-safe) and `cause`; expected errors (validation, 404, 403, conflict) — that one only.
- Centralized error handler: unexpected errors are logged with the stack, the response is `{ error: { code, message, requestId } }`; stack traces never reach the client.
- Always `catch (e: unknown)` and normalize with `e instanceof AppError ? e : toInternalError(e)` while preserving `cause`.
- `requestId` is created by middleware; it goes into the response header and the child logger.

## 5. Validation

- A zod schema for `body`, `query`, `params`; types via `z.infer`, no duplicate interfaces.
- Schemas are strict: `.strict()` plus length and number limits; input is validated at the boundaries (HTTP, repository), not between layers.
- A single response shape: `{ error: { code: 'VALIDATION_ERROR', message, requestId, details } }`, where `details` is the zod `issues`.

## 6. Operations

- pino logs (JSON) with levels; `redact` for `authorization`, `cookie`, `password`.
- External calls with a timeout `fetch(url, { signal: AbortSignal.timeout(3000) })`; plus the server's `connectionTimeout` and `keepAliveTimeout`.
- Graceful shutdown on `SIGINT`/`SIGTERM`: `app.close()`, drain in-flight requests, close the DB pool, `exit(0)`; a force timer — `exit(1)`.
- `/healthz` (liveness) — the process is alive, no external dependencies; `/readyz` (readiness) — DB check, this is what traffic is drained on during deploy.
- `bodyLimit` on the request body; CORS — a narrow origin allowlist, not `*`; headers — `@fastify/helmet`.

## 7. Tests and quality

- `vitest`; the HTTP layer without a port, `app.inject()` or `supertest`; fixtures — factories with defaults (`makeUser({ name })`), not a shared mutable object.
- Do not cover getters and framework config; cover business rules, input, error codes, boundaries.
- In CI: `pnpm typecheck` (`tsc --noEmit`), then `pnpm lint`, `pnpm test`, then the build — all with `--frozen-lockfile`.

## 8. Packages

- Frontend + backend monorepo: pnpm workspaces, `apps/web`, `apps/api`, `packages/shared` (shared DTOs and zod schemas); commit the lockfile, pin versions (`save-exact=true`).
- Do not add dependencies without discussion: attack surface and an obligation to keep them updated; check `node:` and 30 lines of your own code first.
- `pnpm audit --prod` in CI; updates go in separate PRs.

## Minimal example

```ts
// src/config.ts — zod schema and fail fast
import { z } from 'zod';
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
});
const parsed = Env.safeParse(process.env);
if (!parsed.success) { console.error(z.flattenError(parsed.error).fieldErrors); process.exit(1); }
export const config = parsed.data;

// src/app.ts — AppError(code, httpStatus, message, cause) lives in lib/errors.ts
export function buildApp() {
  const app = Fastify({ loggerInstance: logger, bodyLimit: 1_048_576 });
  app.setErrorHandler((error, request, reply) => {
    const e = error instanceof AppError ? error : new AppError('INTERNAL', 500, 'Internal error', { cause: error });
    if (e.httpStatus >= 500) request.log.error({ err: error }, 'unhandled');
    return reply.status(e.httpStatus).send({ error: { code: e.code, message: e.message, requestId: request.id } });
  });
  registerRoutes(app); // routes → services → repositories
  return app;
}

// src/server.ts — listen and graceful shutdown
const app = buildApp();
try { await app.listen({ port: config.PORT, host: '0.0.0.0' }); }
catch (error) { logger.fatal({ err: error }, 'failed to start'); process.exit(1); }
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  const force = setTimeout(() => process.exit(1), 10_000).unref();
  try {
    await app.close(); // stop accepting new connections, let the current ones finish
    await closePool(); // close the DB pool and other resources
    clearTimeout(force);
    process.exit(0);
  } catch (error) { logger.error({ err: error }, 'shutdown failed'); process.exit(1); }
});
```

```yaml
name: ci
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test --run
```

## Checklist

- [ ] Node LTS is pinned (`.nvmrc`/`engines`), `"type": "module"` is enabled.
- [ ] `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `module: nodenext`.
- [ ] The `dev`, `build`, `start`, `typecheck`, `lint`, `test` scripts work.
- [ ] `process.env` is read only in `config.ts` and validated with zod; `.env.example` exists.
- [ ] The `routes`/`services`/`repos` layers are separated, there are no upward imports.
- [ ] `AppError` and a single error handler are wired up, stack traces do not leak to the client.
- [ ] Every route validates `body`/`query`/`params`, types are inferred from the schemas.
- [ ] The API error format is uniform: `code`, `message`, `requestId`, `details`.
- [ ] Logs are structured, with levels, request-id and secret redaction.
- [ ] Graceful shutdown on SIGINT/SIGTERM, the DB pool is closed, a force timeout exists.
- [ ] `/healthz` and `/readyz` differ in purpose.
- [ ] `bodyLimit`, a narrow CORS allowlist and security headers are set.
- [ ] HTTP-layer tests go through `app.inject()`/`supertest`, without a port.
- [ ] CI: `--frozen-lockfile`, typecheck, lint, test, build, `pnpm audit --prod`.

## Anti-patterns

- A response with `stack` to the client → stack to the log, `code` and a safe message to the client.
- `catch (e: any)` → `catch (e: unknown)` and normalization into `AppError` with `cause`.
- Manual `if (!body.email)` checks in handlers → a zod schema and a single error response.
- `app.listen()` in `app.ts` → assemble the app separately from starting it, tests without a port.
- Importing `services` into `repos` just for a type → move the type into a shared module, keep the dependency pointing down.
- `fetch(url)` without a timeout → `AbortSignal.timeout()` on every external call.
- Secrets in a compose file or in code "temporarily" → environment env only.
