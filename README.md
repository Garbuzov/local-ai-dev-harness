# local-ai-dev-harness

A working configuration for an AI coding agent (DeepSeek Harness on Windows 11) that another developer can copy and adapt: agent presets, 10 engineering skills, 4 Node.js tools, a scanner for untrusted instructions, and a verified React + TypeScript project scaffold.

This is not a demo repository. It is the setup I use daily as a hands-on Lead Frontend developer (TypeScript, React, Node.js), and every number below was measured on this machine rather than estimated.

## Why it exists

Two problems that show up the moment you use an agent for real work:

1. **Context is the budget.** Every enabled MCP server puts its tool descriptions into *every* request. The full preset here costs ~15,567 tokens per request before the agent reads a single line of your code; the light preset costs ~1,307. Choosing per task instead of "enable everything" is the difference between a usable and an expensive session.
2. **An agent with network access and credentials is an attack surface.** A third-party skill file is untrusted code that runs with your permissions. This kit ships a scanner for exactly that case, and a local model route for repositories that must not leave the machine.

## Measured results

| What | Measurement |
|---|---|
| Light preset overhead | ~1,307 tokens per request (one MCP server: context7) |
| Full preset overhead | ~15,567 tokens per request (adds chrome-devtools, playwright, memory) |
| Local subagent | `llama3.1:8b` on Ollama returns real tool calls (`finish_reason: tool_calls`), ~12.8 s per call; `qwen2.5-coder:14b` returns the call as text and is therefore unusable for an agent with tools |
| Delegation cost | 12 subagents on a paid model produced 226,455 output tokens versus 238,152 for the entire parent session — the reason the local route exists |
| Tool-output spill | Results above 20,000 bytes are truncated to head/tail and moved to a file instead of being kept in context |

## Repository layout

```text
install.ps1           idempotent installer: backups, YAML self-validation, rollback notes
home/                 files that are installed into ~/.dsh
  cordis.patch.yml    home-level patch: context, cost and search settings
  .agent-presets/     two agent presets, light and full
  skills/             10 skills: code review, debugging, performance, git, Node API, hiring
  tools/              4 tools: instruction scanner, MCP token meter, preset validator, cost report
project-scaffold/     React + TypeScript skeleton with strict types, tests and CI
project-template/     blank AGENTS.md for a project on a different stack
```

Two independent parts:

1. **Harness setup** (`~/.dsh`): global instructions, 10 skills, a security scanner, two agent presets (light by default and full) and a local-model route. Applies to all projects and sessions.
2. **Project template** (`<projects-root>\_template`): a working React + TypeScript skeleton that is verified by running it — typecheck, lint, tests, build.

Everything in the directory is source material. Nothing is applied until you run `install.ps1`.

---

## What gets installed

| File in the kit | Where it goes | Why |
|---|---|---|
| `home/cordis.patch.yml` | `~/.dsh/cordis.patch.yml` | Home-level patch — applied to all profiles. Enables full-text search over session history. |
| `home/skills/*/SKILL.md` | `~/.dsh/skills/` | 10 skills, see the table below. Loaded on demand; only the catalog (name + description) sits in context permanently. |
| `home/tools/*.mjs` | `~/.dsh/tools/` | Four tools: `scan-instructions.mjs` — scanner for third-party instructions (executing code from the network, access to secrets, sending data out, attempts to hide actions); `measure-mcp-tools.mjs` — the token cost of enabled MCP servers; `validate-preset.mjs` — validates preset compositions with the same code the harness uses; `cost-report.mjs` — money across all sessions broken down by line item. |
| `home/.agent-presets/` | `~/.dsh/.agent-presets/` | **Two presets.** `frontend` (default, light): one MCP server, context7, overhead **~1,307 tokens** per request, plus a free subagent on a local model. `frontend-full`: the same capabilities plus chrome-devtools, playwright and memory — **~15,567 tokens**. The composition is edited in `home/.agent-presets/<id>/agent.append.yml`. |
| `project-template/` | `<projects-root>\_template-blank\` | An empty `AGENTS.md` template with placeholder sections — for a project on a different stack. |
| `install.ps1` | — | Installer with backups, idempotent, with YAML self-validation. |

`home/AGENTS.md` is deliberately **not** shipped: global instructions are personal to a machine. If you put your own file at `home/AGENTS.md`, the installer will pick it up and place it into `~/.dsh/AGENTS.md`.

Skills:

| Skill | When it applies |
|---|---|
| `react-review` | Review of a React/TypeScript component: state, hooks, re-renders, boundaries, screen states, accessibility, types |
| `ts-strict-audit` | Raise type strictness in an existing project, find unsafe spots and boundaries |
| `node-api-scaffold` | Scaffold or audit a Node + TypeScript service: structure, config, errors, observability, tests, CI |
| `frontend-perf-audit` | Measure and justify performance with numbers: Core Web Vitals, bundle, rendering, network |
| `browser-debug` | Find the root cause of a frontend bug: reproduction, DevTools, hypothesis, regression test |
| `git-workflow` | Branches, commits, syncing, PRs, emergencies, boundaries for the agent |
| `pr-review` | Review of a pull request of any code: review order, importance labels, risks, report format |
| `interview-prep` | Preparing for a specific interview based on the job posting text |
| `skill-vetting` | Vetting a third-party skill or rule set before first use |
| `webmcp-lab` | Experiments with a page's WebMCP tools through the MCP server that controls the browser |

Additionally, the installer sets `"patchReload": "live"` in `~/.dsh/profiles/desktop/package.json`:
edits to patch files are applied without restarting the application. Disabled with the `-SkipLiveReload` flag.

The installer does **not** install `settings.yaml` — why is explained below.

---

## Installation

```powershell
pwsh -File .\install.ps1
```

Parameters, if the paths are different:

```powershell
pwsh -File .\install.ps1 -ProjectsRoot 'D:\code' -SkipLiveReload
```

Writing happens outside the session's working folder, so permission will be asked once.

### After installation

1. **The preset is already selected by the patch:** new sessions go to the light `frontend`. Another one is chosen
   in the UI: Settings → General → agent preset. It is not set through the `settings.yaml` file —
   the application imports it and renames it (see below).
2. **Restart the application** — `cordis.patch.yml` and `patchReload: live` will be applied.
3. **Create a new session.** Sessions already running stay on their own composition: the preset cannot
   be changed for a session that has already done something.
4. **Check:** ask "what instructions do you have from AGENTS.md and what skills are available".
   Your instructions and ten skills should come back.

### Rollback

```powershell
Copy-Item -Recurse -Force "$env:USERPROFILE\.dsh\_backup\harness-setup-<label>\*" "$env:USERPROFILE\.dsh\"
```

Delete files that did not exist before by hand — the installer marks them as "created".
If the preset broke and sessions cannot be created, choose the `standard` preset in the UI.

---

## Project template

`<projects-root>\_template` — a skeleton that is **verified by running it**: typecheck, lint, 4 tests and
a production build all pass.

Stack: React 19, TypeScript 5.9 (strict mode, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`), Vite 8, Vitest 5 + Testing Library, ESLint 10 (flat config,
type-aware), zod for boundaries, pnpm.

```bash
pnpm install
pnpm check     # typecheck + lint + test
pnpm build     # the same plus a prod build
pnpm dev       # http://localhost:5173
```

What is inside:

```
AGENTS.md              project rules: stack, commands, structure, conventions, boundaries, pitfalls
.dsh/skills/           project skill add-feature: how to add a feature in this skeleton
.github/workflows/     CI: install + typecheck + lint + test + build
src/app/               App, styles
src/features/counter/  example feature: logic in model/, component in ui/, test next to it
src/features/health/   example of network and tagged state (idle | loading | ready | failed)
src/shared/api/http.ts typed client: fetch only here, the response is validated by a schema
src/shared/config/     environment variable validation at application startup
```

How to start a new project:

```powershell
Copy-Item -Recurse "$HOME\AIProjects\_template" "$HOME\AIProjects\my-app"
cd "$HOME\AIProjects\my-app"
git init
pnpm install
pnpm check
```

Then open the project folder as the session workspace in Harness — otherwise the sandbox will not allow
writing to it, and the project `AGENTS.md` and project skills will not be picked up.

### Important about running commands inside a session

Two sandbox limitations, both verified in practice:

- **`pnpm install` inside a restricted session on Windows breaks.** pnpm creates a deep
  tree of junction links, and the file sandbox intercepts these operations: the installation
  ends with `ERR_PNPM_SYMLINK_FAILED: Maximum call stack size exceeded`, and the packages
  remain empty stubs. The fix is to run the installation with full access or, more reliably,
  from a regular terminal outside the harness.
- **`vite build`, `vite dev` and `vitest` inside a restricted session fail with `spawn EPERM`.**
  On Windows, Vite calls `exec('net use')` to check realpath, and the sandbox does not allow
  child processes with intercepted output. `pnpm test` suffers from the same thing.

Conclusion: run the build, tests and dependency installation either in a regular terminal, or
give the session full access for the duration of those commands. An agent inside a restricted
session will not be able to run these commands — it must say so, not claim that "everything works".

---

## Security vetting of third-party instructions

A skill from the internet is text that the agent executes as its own rules. It can be used to
make the agent run a command, read secrets, send code out or weaken the sandbox. Antivirus
will not catch this.

```bash
node ~/.dsh/tools/scan-instructions.mjs <path-to-skill-or-directory>
node ~/.dsh/tools/scan-instructions.mjs <path> --json     # machine output
```

It checks for: executing code from the network, decoding hidden payloads, reading `.env` and keys,
dumping the environment, sending data out, requiring the sandbox to be lifted, instructions to hide
actions from a human, attempts to override system instructions, invisible Unicode characters,
editing the harness configuration, running attached scripts, `npx` without a version, global
installs, dangerous commands, links by IP and through shorteners.

Verdicts and exit codes:

| Verdict | Meaning | Code |
|---|---|---|
| `BLOCK` | There are critical findings. Do not use the file without manually reviewing each one. | 1 |
| `REVIEW` | No critical ones, but there are warnings. Read the flagged lines in context. | 0 |
| `ALLOWED` | Findings suppressed by a marker in the file. This is a human decision, not the scanner's conclusion. | 0 |
| `OK` | No typical techniques found. This is not a guarantee: the file is still read in full. | 0 |

Markers for cases when the file itself quotes dangerous techniques (for example, a skill about security):

```markdown
<!-- scan-instructions:allow-file -->       suppress findings for the whole file
<!-- scan-instructions:allow-next-line -->  suppress findings for the next line
```

Suppressed findings do not disappear: the report lists them with line numbers, and the verdict becomes
`ALLOWED` instead of `OK`. A malicious file can carry such a marker inside itself — that is why
for a freshly downloaded file `ALLOWED` means "someone marked it", and that is a reason to ask who.

The scanner was verified on planted examples: a file with an injection, `curl | bash`, reading `~/.ssh`,
an environment dump, hidden Unicode and an attached script produces `BLOCK` with 11 critical
findings; a harmless skill gives `OK`; markers work at the file and line level.

---

## What was discovered during work (verified, not assumptions)

**Skills and global instructions are picked up without a restart.** After installation, the skill
catalog in a running session updated by itself, and `~/.dsh/AGENTS.md` started to apply.
The skills provider watches `~/.dsh/skills`.

**`settings.yaml` on the desktop profile is not a live settings document.** The application processed
the placed file as a one-time import and renamed it to `settings.yaml.imported`. The default
preset is set through the UI.

**The home-level patch is applied.** Verified with `dsh --profile web --dump-config` on the live
`DSH_HOME`: the `session-query-sqlite` entry got `openAt: first-search` instead of the placed
`never`. The patch replaces the entry's `config` entirely, so both keys are specified in the file.

**Edits to patch files wait for a restart.** `patchReload: live` is read from the profile manifest
at startup; after the first restart, edits are applied on the fly.

**TypeScript 7 already exists, but the tooling does not support it.** Installing the "latest"
versions produced TypeScript 7.0.2, while `typescript-eslint` 8 declares support for `<6.1`. That is why
the template is pinned to TypeScript 5.9.3: otherwise type-aware lint does not work. TS 7 also
removed `baseUrl` from the config — in the template, paths are defined without it.

---

## Layer map: what is configured where

Order from broad to narrow. A narrower layer takes precedence.

| Layer | Where it lives | Scope | When to apply it |
|---|---|---|---|
| Workspace | the folder opened as a session | This session | The sandbox root: writing is allowed only inside it |
| User instructions | `~/.dsh/AGENTS.md` | All projects | Personal rules, stack, boundaries |
| Project instructions | `<project>/AGENTS.md` | Project | The project's stack and conventions, commands, pitfalls |
| Local instructions | `AGENTS.local.md` | Project, not in git | Personal notes about the project |
| Skills | `~/.dsh/skills/`, `<project>/.dsh/skills/`, `<project>/.agents/skills/` | Global / project | Procedures: how to review, how to audit, how to add a feature |
| Agent preset | `~/.dsh/.agent-presets/<id>/` | Session | The set of tools and rules |
| Profile patch | `~/.dsh/profiles/desktop/cordis.patch.yml` | Profile | Settings of a specific profile |
| Home patch | `~/.dsh/cordis.patch.yml` | All profiles | What must apply everywhere |
| User settings | the application UI; `settings.yaml` — one-time import only | All sessions | Default preset, models, providers |

Skills are searched for **one level deep**: `<root>/<name>/SKILL.md` or `<root>/<name>.md`.
The project root is determined by the nearest directory containing `.git`.

---

## Practice: the order of learning

**1. Instructions as leverage.** Ask the agent to do something that violates `AGENTS.md` (for example,
"install library X"). It must refuse and explain. If it did not refuse, the instruction is too soft.

**2. A plan before code.** Turn on plan mode and give a task spanning 3-4 files. The agent must first
explore the repository and propose a plan. Reject it until the plan covers edge cases and tests.

**3. Skills.** "Review `src/features/cart/Cart.tsx` using the react-review skill." Then open
`~/.dsh/skills/react-review/SKILL.md` and add what was missing — the file is read on every
invocation, no restart needed.

**4. Project template.** Copy `_template`, fill in `AGENTS.md` for your task, run
`pnpm check`. The project skill `add-feature` will show how a feature is added in this skeleton.

**5. Security.** Take any skill from GitHub and run the scanner. Look at what it finds
and read the flagged lines. This is a skill that will be useful at work too.

**6. Subagents.** Delegate reconnaissance: "find all places where state is duplicated between
`useState` and server data, return a list with paths". `subagent_fork` inherits the current
conversation, `subagent` starts from scratch.

**7. Workflow.** "Check 20 components for the same problems" is a fan-out of parallel
subagents, not 20 sequential questions.

**8. Goal.** For a long task ("get the project to `pnpm build` without errors"), set a goal:
the session will continue working automatically between rounds.

**9. MCP — one at a time.** Start with `context7` (up-to-date library documentation), then
`chrome-devtools` (traces, network, console, screenshots). Enabling and disabling is an edit of
`disabled: true`
in `~/.dsh/.agent-presets/frontend/agent.cordis.yml`. Watch the token consumption.

**10. Your own preset.** Copy the `frontend` directory into a new one (`exp`, `lean`), change the set of
tools and compare behavior. A preset is a composition with full permissions.

---

## Context economics

- The global + project `AGENTS.md` go into **every** request. Keep them dense.
- The skill catalog (name + description) hangs around permanently, the skill body — only when invoked.
- Every MCP server adds the schemas of all its tools to every request. One GitHub MCP
  without a toolset restriction is hundreds of schemas; that is why the scaffold has
  `GITHUB_TOOLSETS: repos,issues,pull_requests`.
- Anything that must survive a long session, record in files, not in the chat.

---

## What was left out of scope

- **There are two presets, and that is the main saving.** `frontend` (default, set by the home patch)
  adds **~1,307 tokens** per request: only context7 is enabled. `frontend-full`
  also enables chrome-devtools, playwright and memory — **~15,567 tokens**, that is,
  14,260 more in every request. Browser servers are not always needed: keep them
  in the full preset and switch depending on the task. All four are verified by running them.
- **Search, ralph and web-search are cut down.** `tool-web.searchMaxQueries` 4 → 1,
  `web-search-deepseek.maxUses` 5 → 1 (every search is a separate full request to the model),
  `tool-ralph.maxRounds` 64 → 4 (autonomous rounds without human involvement).
- **The main lever is context size, not tools.** In the measured session, 31.4M
  tokens of cache read against 503K of regular input: the bill is determined by the prefix that
  is resent on every step. The built-in compaction starts at 800,000 tokens and never
  triggered (the context reached 409,675). The threshold is lowered to 250,000 with a verbatim
  remainder of 80,000 — on short sessions this changes nothing, on long ones it cuts the main
  line item. Rollback is two lines in `install.ps1`.
- **Large tool outputs are evicted earlier.** `spill-policy.maxInlineBytes`
  50,000 → 20,000 bytes: what does not fit, the model sees as a preview with a link,
  not in full. The policy does not touch `read` results — that is deliberate.
- **A subagent on a local model.** The `subagent_local` tool runs on `llama3.1:8b`
  in Ollama through the `local` route and costs nothing. Verified: out of four local models,
  only it can do tool calls — `qwen2.5-coder` (both 14b and 32b) returns calls
  as text, not through `tool_calls`. Requires the Ollama application to be running.
- **GitHub MCP is disabled for two reasons.** There is no `GITHUB_MCP_TOKEN` variable, and the Docker daemon
  is not running (`docker version` does not connect to `npipe:////./pipe/docker_engine`). The order
  of enabling it: start Docker → create a fine-grained PAT → put it into the user-level
  `GITHUB_MCP_TOKEN` → restart the application. Do not write the token into the preset file.
- **`memory` MCP** — verify the path to the graph file in the package README.
- **WebMCP does not connect directly:** the harness has no browser transport, the bridge is
  `chrome-devtools`. Scenarios are in the `webmcp-lab` skill.
- **Routing, a store, a UI kit, e2e** are deliberately not added to the template: those are decisions of a specific project.

---

## Checks performed before handover

- `install.ps1` was run on a copy of the profile structure and then on the live `DSH_HOME`; both runs
  exited with code 0 — preset assembly, backups, manifest edit, template copy, YAML validation.
- Compositions of the two presets: 24 lines each, no duplicate `id`s, all mentioned packages present,
  `serverName` unique and valid against the mask. Both were found healthy by the harness's own
  check (`~/.dsh/tools/validate-preset.mjs`).
- Frontmatter of all skills: `name` matches the directory, `description` is present, no extra keys.
- The home-level patch was verified on the assembled tree through `--dump-config`.
- Project template: `pnpm check` and `pnpm build` finished with code 0, 4 tests passed,
  the build produced `dist/` (301 KB JS, 92 KB gzip). Package versions are not invented — they were installed
  for real and checked against the Node engine requirements.
- The scanner was verified on planted examples (see the security section), including markers.
- The npm package names of the MCP servers were checked against the npm registry, the Chrome DevTools MCP command —
  against the official README, the GitHub MCP URL and authorization — against the `github/github-mcp-server` repository.
- stdio transport: the MCP SDK uses `cross-spawn` with `shell: false`, so the Windows shims
  `npx.cmd` are resolved correctly, and there are no shell argument substitutions.

Not verified: the operation of the MCP servers inside a session (requires an application restart and a new session
on the `frontend` preset), the composition of the `desktop` profile after a restart, the behavior of skills
on live code, the operation of the template on Node 22.
