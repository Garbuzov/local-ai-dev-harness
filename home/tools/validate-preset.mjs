#!/usr/bin/env node
/**
 * Validates preset compositions with the same code the harness itself uses to validate them:
 * `scanRoot` from `@deepseek-ai/dsh-agent-presets` is the same pass that populates the
 * preset list in the UI. If a preset is broken, the reason here is the same one the
 * user would see in the list.
 *
 * What is checked (per the module documentation): a composition is a list of rows with a
 * plugin name; package names are resolved relative to the harness installation. Plugins are
 * NOT imported here, so the check is safe and fast.
 *
 * Usage:
 *   node validate-preset.mjs [directory-with-presets]
 *
 * By default it checks ~/.dsh/.agent-presets.
 * Exit code: 0 — all presets are healthy, 1 — some are broken, 2 — invocation error.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const MODULES = join(DSH_HOME, 'profiles', 'node_modules')
const PRESETS_PKG = join(MODULES, '@deepseek-ai', 'dsh-agent-presets')

const target = process.argv[2] ?? join(DSH_HOME, '.agent-presets')

// Package name resolution base — the plugin's own file: exactly what the harness passes
// as ctx.baseUrl, that is, the harness installation directory.
const harnessBase = pathToFileURL(join(PRESETS_PKG, 'lib', 'index.js')).href

let discovery
try {
  discovery = await import(pathToFileURL(join(PRESETS_PKG, 'lib', 'types', 'discovery.js')).href)
} catch (error) {
  console.error(`Failed to load the validation module: ${String(error)}`)
  process.exit(2)
}

let presets
try {
  presets = await discovery.scanRoot({ path: target, trust: 'user' }, harnessBase)
} catch (error) {
  console.error(`Failed to scan ${target}: ${String(error)}`)
  process.exit(2)
}

if (presets.length === 0) {
  console.log(`No presets found in ${target}.`)
  process.exit(0)
}

console.log(`Directory: ${target}`)
console.log(`Presets found: ${presets.length}\n`)

let broken = 0
for (const preset of presets) {
  // Health fields have different names depending on the version: we print everything
  // that looks like a verdict and do not pretend we know the schema by heart.
  const id = preset.id ?? preset.preset?.id ?? '(no id)'
  const problem =
    preset.problem ?? preset.reason ?? preset.error ?? preset.health?.problem ?? preset.health?.reason ?? null

  if (problem) {
    broken += 1
    console.log(`  BROKEN  ${id}`)
    console.log(`          reason: ${typeof problem === 'string' ? problem : JSON.stringify(problem)}`)
  } else {
    console.log(`  ok      ${id}`)
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(preset, null, 2))
  }
}

if (broken > 0) {
  console.log(`\nBroken presets: ${broken}. A session on such a preset will not be created —`)
  console.log('the harness will refuse to mount it and name the offending rows.')
  process.exit(1)
}

console.log('\nAll presets are healthy.')
