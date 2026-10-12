---
name: git-workflow
description: Use when you do git work in a frontend project — branches, commits, synchronization, pull requests and emergency situations, including when part of the commands are executed by an AI agent.
whenToUse: Before starting a task, when preparing a commit and a PR, during conflicts and rollbacks.
---

# Git workflow for a frontend developer
Goal: a readable history, a synchronized branch, a small PR and the ability to roll back any action.

## 1. Hygiene before starting
Start with three commands, before any code changes: `git status` (uncommitted and untracked), `git log --oneline -10` (the accepted message format), `git fetch --prune` (update the remote and drop deleted branches).

Do not start on a dirty tree: you will not tell your changes from someone else's, `git switch`/`git pull` will drag foreign edits into your commit, and rolling back a mistake becomes ambiguous. Set uncommitted work aside temporarily:

```bash
git stash push -m "wip: profile form validation"
git stash list
git stash pop                # restore and remove from the stack
git stash apply stash@{0}    # restore and keep in the stack
```

Stash is temporary storage, not an archive. Do not keep work in it longer than a session.

## 2. Branches
Naming scheme: `<type>/<short-slug>`, slug in kebab-case, in English — `feat/user-profile-form`, `fix/duplicate-fetch-on-mount`, `chore/bump-vite`, `refactor/extract-use-auth-hook`.

What to branch from: from `main` if the release goes from `main`; from `develop` if the history shows `Merge branch 'develop'` and release branches. Determine it from the history, do not guess: `git log --oneline --graph --all -20`, `git branch -r`, `git log --merges --oneline -10`.

Creation: `git fetch origin`, then `git switch main && git pull --rebase`, then `git switch -c feat/user-profile-form`.

Rebase vs merge in a feature branch: rebase — while the branch is only yours and is not in `main`, gives a linear history (`git rebase origin/main`); merge — if the branch has already been reviewed, the history honestly keeps the branch point. Do not rebase a branch someone else is using without warning them.

## 3. Commits
Conventional Commits, the subject in the imperative, up to 72 characters, in English. Types: `feat:` new user-facing functionality, `fix:` a behavior fix, `refactor:` a code change without a behavior change, `test:` tests without changing production code, `docs:` documentation and README, `chore:` build, dependencies and CI, `perf:` optimization with a measurable effect, `style:` formatting without semantic changes.

```
fix(auth): prevent duplicate refresh token request

Two widgets mounted concurrently and both saw an expired token.
Guard the refresh with a single in-flight promise.

Closes #241
```
The body answers "why"; the "what" is visible in the diff. One commit — one logical change: if the subject contains "and", the commit must be split. Split with `git add -p` (including `git add -p src/app.ts`).

Committed too much: `git commit --amend` extends the last commit if it is not pushed; `git reset --soft HEAD~1` removes the commit and keeps the changes staged; `git reset` unstages the changes and keeps them in the working tree. `--amend` and `reset` on a pushed shared branch rewrite history — only with a human's permission.

## 4. Synchronization
Pull the base into your branch via rebase, not merge: `git fetch origin`, then `git rebase origin/main`.

Conflict resolution order: (1) `git status` — the list of conflicting files; (2) remove the `<<<<<<<`, `=======`, `>>>>>>>` markers, keep the correct code; (3) `git add <file>` after each file; (4) `git rebase --continue`, and on new conflicts start again from step 1; (5) `git rebase --abort` restores everything as it was, this is safe and always available; (6) run typecheck, lint and tests — rebase yields code that is syntactically valid but logically broken.

Do not merge the lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`) by hand — take the target branch version and regenerate: `git checkout --theirs pnpm-lock.yaml` (during rebase "theirs" is your branch), `pnpm install`, `git add pnpm-lock.yaml package.json`.

Force-push after a rebase — `git push --force-with-lease`, only to your own feature branch, never to `main`/`develop`/release. `--force-with-lease` refuses to push if the remote has moved ahead; `--force` silently wipes someone else's work.

## 5. Pull request
Size: one logical task, a guideline of up to ~400 lines of diff. More — split it, unless that breaks the build. The first push of the branch — `git push -u origin feat/user-profile-form`, creating the PR — `gh pr create --fill` or `gh pr create --draft --title "feat: user profile form" --body "WIP"`.

Description: what changed, why, how to verify (steps and expected result), screenshots or video for UI, a link to the issue. Issue linkage — `Closes #241` (closes it) or `Refs #241` (does not close it).

Review: answer every comment with a fix or a justification, do not resolve other people's comments. Responding to a review is a regular `git push`; a force-push is needed only after a rebase.

## 6. Emergency situations
`git reflog` is the main rescue tool: it stores HEAD movements, including commits lost after `reset`, `rebase` and branch deletion. Recovery from there: `git switch -c rescue <sha>` or `git reset --hard <sha>`.

`git restore <file>` returns the file from the index or HEAD and does not touch the history. `git reset` moves the branch pointer and rewrites history — only for local, unpushed commits. `git revert <sha>` creates a new commit that undoes the specified one — the only safe rollback of what is already in a shared branch.

Recovering a deleted branch: `git reflog`, then `git switch -c feat/lost-branch <sha>` and `git push -u origin feat/lost-branch`. Undoing a merge: `git merge --abort` if the merge is not finished; `git revert -m 1 <merge-sha>` if it is already in `main`.

Committed a secret by accident: consider it compromised and rotate/revoke it immediately (a mandatory step); remove the value from the code and commit the fix; clean the history (`git filter-repo`, BFG) and coordinate the force-push with the whole team. Removing it from the history guarantees nothing: the value may already have reached forks, CI caches and notifications.

## 7. What the agent does only with a human's permission
Rule: the agent does not run a single command from the list without the human's explicit confirmation in the current session.

- `git commit` of any kind, including `--amend`.
- `git push`, `git push -u`, `git push --force`, `--force-with-lease`.
- `git reset` in any mode, `git checkout -- <file>`, `git restore` over someone else's edits.
- `git rebase`, `git cherry-pick`, `git revert`, history rewriting (`filter-repo`, BFG).
- Deleting branches and tags, local and on the remote.
- `git stash drop`, `git clean -fd`, `git branch -D`.

The agent may read freely: `status`, `log`, `diff`, `show`, `reflog`, `fetch`, `blame`. If a mutating command is needed — propose it as an exact line and wait for confirmation.

## 8. Check before committing
- `git diff --staged` — read every hunk, there must be no junk in the index.
- No secrets: keys, tokens, passwords, `.env` contents, private URLs.
- No debug code: `console.log`, `debugger`, commented-out blocks, `TODO` without an issue.
- No stray files: `.DS_Store`, local configs, dumps.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` have been run.
- The message matches Conventional Commits, is imperative, up to 72 characters.

## Full-cycle checklist
- [ ] The task and the linked issue are read, the boundaries are clear.
- [ ] `git status` is clean or the changes are set aside with `git stash push -m`.
- [ ] `git fetch --prune` is done, the base (`main`/`develop`) is up to date.
- [ ] The branch to fork from is determined from the history.
- [ ] The branch is created with `git switch -c <type>/<slug>`.
- [ ] The changes are small and on topic, with no unrelated refactoring.
- [ ] `git add -p` is used to split the changes across commits.
- [ ] Each commit is atomic and named according to Conventional Commits.
- [ ] The commit body explains "why", not "what".
- [ ] `git diff --staged` is read before every commit.
- [ ] No secrets or debug code got into the index.
- [ ] Typecheck, lint and tests pass locally.
- [ ] `git rebase origin/main` is done, conflicts are resolved and verified.
- [ ] The lockfile was regenerated on conflict, not merged by hand.
- [ ] `git push -u origin <branch>` is done.
- [ ] The PR is small, with a description, verification steps and screenshots for UI.
- [ ] The PR is linked to the issue (`Closes #N` or `Refs #N`).
- [ ] Review comments are addressed, the branch is updated, CI is green.

## Dangerous commands
- `git push --force` — wipes someone else's commits on the remote without warning. Use `--force-with-lease` instead and only on your own branch.
- `git reset --hard <sha>` — permanently deletes uncommitted changes. `git stash push -m` first, roll back via `git reflog`.
- `git reset` / `--amend` on a pushed shared branch — rewrites history and breaks colleagues' branches. Use `git revert` instead.
- `git clean -fd` — deletes untracked files, including local configs and `.env`. `git clean -nd` first.
- `git branch -D <branch>` — deletes a branch without checking for unmerged commits. Use `-d`, recover what is lost via `git reflog`.
- `git rebase` on a shared branch — rewrites commits that others already have. Rebase only your own feature branch.
- `git checkout -- <file>` / `git restore <file>` — silently wipe uncommitted edits. Save them to a stash first.
- `git commit --no-verify` — bypasses hooks and lets into the commit exactly what they catch. Only deliberately and with an explanation.
