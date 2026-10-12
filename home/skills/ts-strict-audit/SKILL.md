---
name: ts-strict-audit
description: Use when you need to raise type safety in an existing TypeScript project (React + Node) or audit it for unsafe types and unsafe boundaries.
whenToUse: When enabling strict flags, reviewing types, and migrating legacy code to strict TypeScript.
---
## 1. Base: `tsconfig.json`
```json
{ "compilerOptions": {
    "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true, "isolatedModules": true,
    "noImplicitOverride": true, "noFallthroughCasesInSwitch": true, "noUnusedLocals": true, "noUnusedParameters": true,
    "verbatimModuleSyntax": true, "module": "nodenext", "moduleResolution": "nodenext", "target": "es2023",
    "lib": ["es2023"], "types": ["node"], "skipLibCheck": false, "incremental": true, "noEmit": true },
  "include": ["src", "test"] }
```
- `strict` — the umbrella: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `useUnknownInCatchVariables`; enable it first, in full.
- `noUncheckedIndexedAccess` — `arr[i]` and `obj[key]` yield `T | undefined`; `exactOptionalPropertyTypes` — `{ a?: string }` does not accept `{ a: undefined }`.
- `noImplicitOverride` — `override` is mandatory; `noFallthroughCasesInSwitch` — a `case` without `break` and `return` is forbidden; `isolatedModules` — per-file transpilation (esbuild, swc).
- `verbatimModuleSyntax` — `import type` is written explicitly; `module`/`moduleResolution: nodenext` — Node 22+ ESM/CJS boundaries (for Vite — `"esnext"` + `"bundler"`, do not mix the pairs).
- `skipLibCheck: false` — the `.d.ts` files of dependencies are checked too: slower, but `true` is not a way to hide your own errors; `target`/`lib` — app `["dom", "es2023"]`, server — `es2023` + `types: ["node"]`.

## 2. Replacing unsafe types
```ts
type Point = { x: number; y: number };                   // object -> concrete shape
type Mapper = (value: unknown) => unknown;               // Function -> signature
const Role = { Admin: "admin", User: "user" } as const;  // enum -> as const + union
type Role = (typeof Role)[keyof typeof Role];
type UserId = string & { readonly __brand: "UserId" };   // string -> branded type (the single cast)
const asUserId = (raw: string): UserId => raw as UserId;
const root = document.getElementById("root");            // non-null ! -> explicit check
if (!root) throw new Error("#root not found");
function parse(input: unknown): string {                 // any -> unknown + narrowing
  if (typeof input !== "string") throw new TypeError("string expected");
  return input.trim();
}
```
## 3. Narrowing and control flow
```ts
type Result = { kind: "ok"; data: string } | { kind: "err"; error: Error }; // discriminated union
const render = (r: Result): string => { switch (r.kind) {
    case "ok": return r.data;
    case "err": return r.error.message;
    default: { const never: never = r; throw new Error(`unhandled: ${String(never)}`); } } };
const cfg = { retries: 3, url: "/api" } satisfies Record<string, string | number>;
const isUser = (v: unknown): v is { id: string } => typeof v === "object" && v !== null && "id" in v; // + Array.isArray for arrays
```
- `satisfies` checks the shape without widening the inference; `x is T` — predicates, `asserts x is T` — input validators; `in`/`typeof`/`instanceof` narrow by key, primitive, class.
- Narrow through a local variable: narrowing is lost after `await` and inside callbacks.

## 4. Boundaries: external data
```ts
const UserSchema = z.object({ id: z.string(), age: z.number().int().optional() });
type User = z.infer<typeof UserSchema>;                   // the type is inferred from the schema
const loadUser = async (id: string): Promise<User> => {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw: unknown = await res.json();                  // no generic casts
  return UserSchema.parse(raw);
};
const parseJson = (text: string): unknown => JSON.parse(text) as unknown;
try { await loadUser("1"); } catch (e: unknown) { throw new Error(String(e instanceof Error ? e.message : e)); }
```
- The schema lives at the network or process boundary, the inferred type goes inward; `res.json()` and `JSON.parse` — `unknown` only (valibot: `v.InferOutput<typeof S>`).

## 5. Generics and utilities
```ts
const first = <T>(items: readonly T[]): T | undefined => items[0];
const pick = <T extends object, K extends keyof T>(o: T, ks: readonly K[]): Pick<T, K> => Object.fromEntries(ks.map((k) => [k, o[k]])) as Pick<T, K>;
```
- A generic is justified when the input and output types are linked; without a link — use a concrete type; `extends` constrains the parameter, `= Default` provides a default value.
- `keyof` yields key names, `typeof value` — the type of the value, `readonly T[]` — for non-mutating functions; `Record<K, V>` — a dictionary, `Map<K, V>` — non-string keys and insertion order; conditional types — at most two levels.

## 6. React
```tsx
type ButtonProps = { label: string; variant?: "primary" | "ghost"; children?: React.ReactNode;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void };
const Input = ({ ref, ...props }: React.ComponentPropsWithRef<"input">) => <input ref={ref} {...props} />; // ref — prop since React 19
type ListProps<T> = { items: readonly T[]; render: (item: T) => React.ReactNode };
const List = <T,>({ items, render }: ListProps<T>) => <ul>{items.map((i, n) => <li key={n}>{render(i)}</li>)}</ul>;
function Card(props: React.ComponentProps<typeof Button>) { return null; }
```
- Variants are a union, not `string`; `children` is `ReactNode`, not `JSX.Element`; events come from `React.*Event<HTML...Element>`.
- Write a generic component as `<T,>`; `useRef<HTMLInputElement>(null)` — DOM, `useRef<number | null>(null)` — a value; do not cast nodes via `as`, inherit props via `ComponentProps<typeof X>`; `forwardRef` is needed only before React 19.

## 7. Migrating a non-strict project
1. Enable one at a time: `strict`, then `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess` last; after each flag count the remainder: `pnpm exec tsc --noEmit --pretty false | grep -c 'error TS'`.
2. Order of fixes: `src/shared` → `src/api` → hooks → components → tests and `*.stories.tsx`; `@ts-ignore` is forbidden, only `// @ts-expect-error <reason>` with a link to the task.
3. Do not mask your own errors with `skipLibCheck`, `exclude`, and `@ts-nocheck`; for third-party types use a minimal `declare module`; every `any` from the diff → `unknown` + narrowing in the same PR.

## 8. Commands and verification
```bash
pnpm exec tsc --noEmit && pnpm exec tsc --noEmit --incremental --tsBuildInfoFile .tsbuildinfo
pnpm exec eslint . --max-warnings 0
```
- ESLint + `@typescript-eslint`: `no-explicit-any`, `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call`, `no-unsafe-argument`, `no-unsafe-return`, `consistent-type-imports`, `no-floating-promises`.
- Type-aware rules require `parserOptions.projectService: true`, otherwise `no-unsafe-*` stay silent; the CI step with types and lint runs before the tests.

## Audit checklist
- [ ] Read `tsconfig.json` and its inheritors, list the missing flags from section 1; separate the app and server configs, check `lib` and `types`.
- [ ] Run `tsc --noEmit`, save the log and the error count as the baseline.
- [ ] Count `any` (`grep -rEn '\bany\b' src`) and find `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` without a reason.
- [ ] Find non-null `!`, `as` casts to domain types, `object`, `Function`, `{}`, `enum` — replace with checks, schemas, unions, and `as const`.
- [ ] Verify that network responses, `JSON.parse`, and `localStorage` go through a schema or a predicate.
- [ ] Check `catch` (`instanceof Error` only) and the `never` branches in every `switch` over a union.
- [ ] Check the types of props, exports, and hooks: no `any`, explicit return types, no redundant inline duplicates.
- [ ] Enable the type-aware `@typescript-eslint` rules, drive them to `--max-warnings 0`.
- [ ] Add `tsc --noEmit` and `eslint` to CI before the tests.
- [ ] Enable the flags from section 1 one at a time in the order from section 7, then `skipLibCheck: false`.
- [ ] Record the remaining `@ts-expect-error` and a plan to remove them.
- [ ] Repeat the baseline `tsc` measurement and compare the error count with the original one.

## Common typing mistakes
- `catch (e: any)` → `catch (e: unknown)` and narrowing via `instanceof Error`.
- `(await res.json()) as User` → `const raw: unknown = await res.json()` and `UserSchema.parse(raw)`.
- `variant: string` → `variant: "primary" | "ghost"`.
- `(x: object)`, `cb: Function` → a concrete shape and an explicit signature.
- `items[0].id` under `noUncheckedIndexedAccess` → an `undefined` check or `first(items)`.
- `enum Status {}` → an `as const` object plus a union of literals.
- `el as HTMLInputElement`, `el!.value` → `instanceof HTMLInputElement` or an early `throw`.
- `// @ts-ignore` → `// @ts-expect-error` with a reason and a link to the task.
