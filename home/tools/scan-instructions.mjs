#!/usr/bin/env node
/**
 * Scanner for third-party agent instructions.
 *
 * Checks Markdown files (SKILL.md, AGENTS.md, README and any .md) for tricks by
 * which foreign text can steer the agent: executing code from the network, accessing
 * secrets, sending data out, attempts to hide its actions from the human.
 *
 * The scanner does not replace a human reading the file. It catches typical tricks
 * and lowers the chance of missing the obvious.
 *
 * Usage:
 *   node scan-instructions.mjs <path-to-file-or-directory> [--json]
 *
 * Exit code:
 *   0 — no blocking findings (verdict OK or REVIEW)
 *   1 — at least one CRITICAL finding (verdict BLOCK)
 *   2 — invocation or read error
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const MAX_FILE_BYTES = 512 * 1024

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }
const SEVERITY_LABEL = { critical: 'CRITICAL', warning: 'WARNING ', info: 'INFO    ' }

/**
 * Each rule: what we look for, why it is dangerous and what to do.
 * pattern applies to the whole line, isRegex allows catching hidden characters.
 */
const RULES = [
  {
    id: 'pipe-to-shell',
    severity: 'critical',
    pattern: /\b(curl|wget|iwr|Invoke-WebRequest|Invoke-RestMethod)\b[^\n|]*\|\s*(sudo\s+)?(bash|sh|zsh|iex|Invoke-Expression)\b/i,
    why: 'Downloading and immediately executing code from the network. The content can change at any moment.',
    fix: 'Download the file, read it, pin the version or hash. Do not execute a stream from the network.',
  },
  {
    id: 'decode-blob',
    severity: 'critical',
    pattern: /\b(base64|frombase64string|certutil)\b[^\n]*(-d\b|--decode|decode)/i,
    why: 'Decoding a hidden payload — the standard way to hide commands from the eye.',
    fix: 'Demand the original readable text. If there is none — do not use the file.',
  },
  {
    id: 'read-credentials',
    severity: 'critical',
    pattern: /\b(cat|type|get-content|less|more|read)\b[^\n]*(\.env\b|\.ssh\b|id_rsa|id_ed25519|\.aws[\\/]credentials|\.netrc|\.npmrc|\.git-credentials|credentials\.yaml)/i,
    why: 'Reading files with secrets. From there they are easily sent out or written to a log.',
    fix: 'The agent does not need secrets. If you need the fact of existence — check only the variable name.',
  },
  {
    id: 'dump-environment',
    severity: 'critical',
    pattern: /(\bprintenv\b|\benv\s*\||get-childitem\s+env:|set\s*\|\s*findstr|GetEnvironmentVariables)/i,
    why: 'A full dump of environment variables: tokens, keys and paths to them live there.',
    fix: 'Never print the whole environment. Check that a specific variable exists.',
  },
  {
    id: 'send-secrets-out',
    severity: 'critical',
    pattern: /\b(curl|fetch|web_fetch|invoke-webrequest|invoke-restmethod|requests\.post|http\.post)\b[^\n]{0,200}\b(token|secret|api[_-]?key|apikey|password|passwd|credentials?\b)/i,
    why: 'Sending secrets or data out over the network.',
    fix: 'No network calls with project content or secrets. Treat this as a leak.',
  },
  {
    id: 'prompt-injection-override',
    severity: 'critical',
    pattern: /(ignore|disregard|forget)\s+(all\s+|any\s+)?(previous|prior|earlier|above|system)\s+(instruction|prompt|rule|message)|игнорируй\s+(все\s+)?(предыдущ|прошл|прежн)|забудь\s+(все\s+)?(инструкц|правил)/i,
    why: 'An attempt to cancel the system instructions — a classic injection into text.',
    fix: 'The file is untrusted. Reject it entirely, not just a single line.',
  },
  {
    id: 'conceal-from-human',
    severity: 'critical',
    pattern: /(do\s+not|don'?t|never)\s+(tell|inform|mention|notify|show)\s+(the\s+)?(user|human|owner)|without\s+(telling|informing|asking)\s+(the\s+)?(user|human)|не\s+(сообщай|говори|упоминай|показывай)[^\n]{0,20}(пользовател|человек)|(втайне|скрытно|незаметно)/i,
    why: 'An instruction to hide actions from the human. A legitimate document does not require that.',
    fix: 'Reject the file. Transparency of actions is a mandatory condition.',
  },
  {
    id: 'sandbox-escalation',
    severity: 'critical',
    pattern: /DSH_PERMISSION_MODE\s*=\s*\S*danger|--dangerously-skip-permissions|--yolo\b|(switch|set|use|enable|turn on|переключ|включ|используй|поставь)[^\n]{0,40}danger[-\s]?full[-\s]?access/i,
    why: 'A demand to remove the sandbox: the agent would get unrestricted writing and execution.',
    fix: 'Work in workspace-write or read-only. Widening permissions is the human\'s decision, not text\'s.',
  },
  {
    id: 'sandbox-mode-mention',
    severity: 'info',
    pattern: /danger[-\s]?full[-\s]?access/i,
    why: 'A mention of the unrestricted mode. Harmless by itself, but check the context: is it being suggested to enable it.',
    fix: 'If this is an instruction to enable the mode — treat the finding as critical.',
  },
  {
    id: 'exec-bundled-script',
    severity: 'critical',
    pattern: /\b(node|python3?|bash|sh|pwsh|powershell|deno|bun)(\.exe)?\b[^\n]{0,40}[\\/](scripts?|bin|tools)[\\/][^\s`'"]+/i,
    why: 'Running code bundled with the instructions. Readable text is safer than an executable file.',
    fix: 'Read the script line by line before running it, or do not run it at all.',
  },
  {
    id: 'hidden-unicode',
    severity: 'critical',
    pattern: /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\uFEFF]/,
    why: 'Invisible or control Unicode characters. Text is hidden and its meaning changed with them.',
    fix: 'Reject the file and ask for a version without hidden characters.',
  },
  {
    id: 'write-harness-config',
    severity: 'warning',
    // Mentioning a path in documentation is harmless; instructing to change it is dangerous.
    pattern: /(запиши|измени|отредактируй|обнови|положи|скопируй|перезапиши|write|edit|modify|update|create|copy|replace|overwrite)[^\n]{0,80}(cordis\.patch\.yml|settings\.yaml|profiles[\\/](desktop|web)|\.agent-presets|\.dsh[\\/]skills)|(cordis\.patch\.yml|settings\.yaml|profiles[\\/](desktop|web)|\.agent-presets|\.dsh[\\/]skills)[^\n]{0,80}(запиши|измени|отредактируй|обнови|write|edit|modify|update|overwrite)/i,
    why: 'The instruction changes the harness configuration itself — that is, the rules by which the agent works.',
    fix: 'Check by hand: which lines exactly change and why. Edit it yourself, not on orders from a file.',
  },
  {
    id: 'install-without-pin',
    severity: 'warning',
    pattern: /\b(npx|pnpm\s+dlx|bunx)\s+(-y\s+|--yes\s+)?@?[a-z0-9][a-z0-9._/@-]*(?!@[\d^~])/i,
    why: 'Running a package without a pinned version: safe today, different tomorrow.',
    fix: 'Pin the version (pkg@1.2.3) or install it into the project as an explicit dependency.',
  },
  {
    id: 'global-install',
    severity: 'warning',
    pattern: /\b(npm|pnpm)\s+(i|install|add)\s+(-g|--global)\b|\bpip\s+install\b|\bchoco\s+install\b|\bwinget\s+install\b/i,
    why: 'Installing system-wide, outside the project: traces remain, rollback is harder.',
    fix: 'Install into the project. A global install is a deliberate decision by the human.',
  },
  {
    id: 'hooks-or-permissions',
    severity: 'warning',
    pattern: /^\s*(allowed-tools|hooks|permissions|mcp-servers?)\s*:/im,
    why: 'Widening permissions or automating code execution, hidden in the file metadata.',
    fix: 'Read the corresponding block in full and make sure you understand the consequences.',
  },
  {
    id: 'destructive-command',
    severity: 'warning',
    pattern: /\brm\s+-[a-z]*r[a-z]*f|\bRemove-Item\b[^\n]*-Recurse[^\n]*-Force|\bformat\s+[a-z]:|\bmkfs\b/i,
    why: 'Recursive deletion or formatting: a single typo destroys data.',
    fix: 'Check the exact path before deleting, make a backup.',
  },
  {
    id: 'force-push',
    severity: 'warning',
    // --force-with-lease — the safe option, it is handled by a separate rule below.
    pattern: /\bgit\s+push\b[^\n]*(--force\b(?!-with-lease)|-f\b)/i,
    why: 'Rewriting the history of a remote branch. On a shared branch it breaks the work of others.',
    fix: 'Use --force-with-lease and only on a personal branch, never on main.',
  },
  {
    id: 'force-with-lease',
    severity: 'info',
    pattern: /--force-with-lease\b/i,
    why: 'Rewriting history with a check that nobody else moved the branch. Acceptable on a personal branch.',
    fix: 'Make sure the branch is personal and that nobody has built on top of it.',
  },
  {
    id: 'raw-ip-or-shortener',
    severity: 'warning',
    // Local and private addresses are normal in documentation; external IPs are suspicious.
    pattern: /\b(?!127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly)\b/i,
    why: 'Access by IP or through a link shortener: it is impossible to tell where the request goes.',
    fix: 'Demand a domain name. Check what the address is for.',
  },
  {
    id: 'external-url',
    severity: 'info',
    pattern: /https?:\/\/[^\s)>\]"']+/i,
    why: 'An external link: harmless by itself, but requires checking the source.',
    fix: 'Open the link and make sure the source is official.',
  },
  {
    id: 'bypass-verification',
    severity: 'info',
    pattern: /--no-verify\b|--no-gpg-sign\b|\bskip\s+(the\s+)?(test|check)/i,
    why: 'Bypassing checks before committing or handing in work.',
    fix: 'Checks exist for a reason. Bypassing them is a deliberate decision by the human.',
  },
]

function walk(target) {
  const stats = statSync(target)
  if (stats.isFile()) {
    return target.toLowerCase().endsWith('.md') ? [target] : []
  }
  const found = []
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const full = join(target, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      found.push(...walk(full))
    } else if (entry.name.toLowerCase().endsWith('.md')) {
      found.push(full)
    }
  }
  return found
}

/** Executable files attached to instructions are more dangerous than the text itself. */
function findExecutablePayloads(scanRoot) {
  const stats = statSync(scanRoot)
  const root = stats.isFile() ? resolve(scanRoot, '..') : scanRoot
  const payloads = []
  const interesting = /[\\/](scripts?|bin)[\\/]/i

  const visit = (dir, depth) => {
    if (depth > 4) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(full, depth + 1)
      } else if (interesting.test(full) && /\.(c|m)?js$|\.ps1$|\.sh$|\.py$|\.bat$|\.cmd$|\.exe$/i.test(entry.name)) {
        payloads.push(full)
      }
    }
  }

  try {
    visit(root, 0)
  } catch {
    return []
  }
  return payloads
}

/**
 * Markers for a human who has reviewed the findings by hand:
 *   <!-- scan-instructions:allow-file -->       — drop findings for the whole file
 *   <!-- scan-instructions:allow-next-line -->  — drop findings for the next line
 *
 * A marker does NOT make a file "safe": the ALLOWED verdict means "the human looked
 * and decided", and the report always says so. That is exactly why the marker is visible.
 */
const ALLOW_FILE_RE = /<!--\s*scan-instructions:allow-file\s*-->/i
const ALLOW_NEXT_RE = /<!--\s*scan-instructions:allow-next-line\s*-->/i

function scanText(text) {
  const lines = text.split(/\r?\n/)
  const allowFile = ALLOW_FILE_RE.test(text)
  const findings = []

  lines.forEach((line, index) => {
    const previous = index > 0 ? lines[index - 1] : undefined
    const allowedByLine = previous !== undefined && ALLOW_NEXT_RE.test(previous)
    const suppressed = allowFile || allowedByLine

    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({
          severity: rule.severity,
          id: rule.id,
          line: index + 1,
          excerpt: line.trim().slice(0, 160),
          why: rule.why,
          fix: rule.fix,
          suppressed,
        })
      }
    }
  })

  return { findings, allowFile }
}

function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const target = args.find((arg) => !arg.startsWith('--'))

  if (!target) {
    console.error('Usage: node scan-instructions.mjs <file-or-directory> [--json]')
    process.exit(2)
  }

  let resolved
  try {
    resolved = resolve(target)
    statSync(resolved)
  } catch {
    console.error(`Not found: ${target}`)
    process.exit(2)
  }

  const files = walk(resolved)
  const report = {
    target: resolved,
    files: [],
    allowMarkedFiles: [],
    payloads: [],
    verdict: 'OK',
    counts: { critical: 0, warning: 0, info: 0, allowed: 0 },
  }

  for (const file of files) {
    const stats = statSync(file)
    if (stats.size > MAX_FILE_BYTES) {
      report.files.push({ path: relative(resolved, file) || file, skipped: 'file is larger than 512 KiB', findings: [] })
      continue
    }
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch (error) {
      report.files.push({ path: file, skipped: `read error: ${String(error)}`, findings: [] })
      continue
    }
    const { findings: allFindings, allowFile } = scanText(text)
    const suppressed = allFindings.filter((finding) => finding.suppressed)
    const findings = allFindings.filter((finding) => !finding.suppressed)
    report.counts.allowed += suppressed.length
    for (const finding of findings) {
      report.counts[finding.severity] += 1
    }
    report.files.push({
      path: files.length === 1 ? file : relative(resolved, file) || file,
      allowFile,
      findings,
      suppressed,
    })
    if (allowFile) {
      report.allowMarkedFiles.push(files.length === 1 ? file : relative(resolved, file) || file)
    }
  }

  report.payloads = findExecutablePayloads(resolved)
  if (report.payloads.length > 0) {
    // An attached script is not maliciousness by itself, but requires reading before running.
    report.counts.warning += report.payloads.length
  }

  // Order matters: unsuppressed warnings are more informative than the fact that a marker was applied.
  report.verdict =
    report.counts.critical > 0
      ? 'BLOCK'
      : report.counts.warning > 0
        ? 'REVIEW'
        : report.allowMarkedFiles.length > 0
          ? 'ALLOWED'
          : 'OK'

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`Checked: ${report.target}`)
    console.log(`.md files: ${report.files.length}\n`)

    for (const file of report.files) {
      const findings = [...file.findings].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.line - b.line,
      )
      const suppressed = file.suppressed ?? []
      if (file.skipped) {
        console.log(`--- ${file.path} — SKIPPED (${file.skipped})`)
        continue
      }
      if (findings.length === 0 && suppressed.length === 0) {
        console.log(`--- ${file.path} — clean`)
        continue
      }
      console.log(`--- ${file.path}`)

      if (suppressed.length > 0) {
        console.log(
          `  ALLOWED  findings dropped by marker: ${suppressed.length}${file.allowFile ? ' (marker applies to the whole file)' : ''}`,
        )
        for (const finding of suppressed) {
          console.log(`      dropped: line ${finding.line} [${finding.id}] ${finding.excerpt}`)
        }
        console.log('      This is a human decision, not the scanner verdict. The "OK" rating does not apply to this file.')
      }

      if (findings.length === 0) {
        console.log('')
        continue
      }
      const bySeverity = { critical: [], warning: [], info: [] }
      for (const finding of findings) bySeverity[finding.severity].push(finding)

      for (const severity of ['critical', 'warning', 'info']) {
        const group = bySeverity[severity]
        if (group.length === 0) continue
        if (severity === 'info') {
          console.log(`  ${SEVERITY_LABEL[severity]} ${group.length} matches (links and check bypasses) — review by hand`)
          continue
        }
        for (const finding of group) {
          console.log(`  ${SEVERITY_LABEL[severity]} line ${finding.line} [${finding.id}]`)
          console.log(`      text: ${finding.excerpt}`)
          console.log(`      why:  ${finding.why}`)
          console.log(`      do:   ${finding.fix}`)
        }
      }
      console.log('')
    }

    if (report.payloads.length > 0) {
      console.log('Attached executable code (read before running):')
      for (const payload of report.payloads) {
        console.log(`  ${SEVERITY_LABEL.warning} ${payload}`)
      }
      console.log('')
    }

    console.log(
      `Verdict: ${report.verdict}  (critical ${report.counts.critical}, warning ${report.counts.warning}, info ${report.counts.info}, dropped by marker ${report.counts.allowed})`,
    )
    if (report.verdict === 'BLOCK') {
      console.log('Do not use the file without a manual review of every critical finding.')
    } else if (report.verdict === 'ALLOWED') {
      console.log('Findings were dropped by a marker in the file: this is a human decision, not the scanner verdict.')
    } else if (report.verdict === 'REVIEW') {
      console.log('Read the flagged lines in context and decide for yourself whether this is acceptable.')
    }
  }

  process.exit(report.verdict === 'BLOCK' ? 1 : 0)
}

main()
