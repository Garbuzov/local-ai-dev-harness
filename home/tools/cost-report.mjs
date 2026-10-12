#!/usr/bin/env node
/**
 * Computes the cost of sessions in money according to the provider price list.
 *
 * DSH does not store prices and does not count currency — only tokens. The tool takes
 * already counted tokens from the projection cache (it holds ready totals per session,
 * including child sessions) and converts them into dollars at the deepseek-flash price.
 *
 * Token source: <dshHome>/storages/session_projcache/sessions/<id>.json
 *   → record.rows.tokenUsage.val.totals  { uncachedInputTokens, outputTokens,
 *                                          cacheReadTokens, cacheWriteTokens }
 *
 * Price: https://api-docs.deepseek.com/quick_start/pricing/ — per 1M tokens.
 * Peak hours 01:00–04:00 and 06:00–10:00 UTC on weekdays, that is 04:00–07:00
 * and 09:00–13:00 Moscow time; the rest of the time it is twice cheaper. It is
 * impossible to assign each request to peak or off-peak from this data — the
 * projection has no per-request timestamps, so both bounds are printed: "off-peak" and "peak".
 *
 * Usage:
 *   node cost-report.mjs [--json] [--top N]
 *
 * Exit code: 0 — report built, 2 — projection directory not found.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const CACHE_DIR = join(DSH_HOME, 'storages', 'session_projcache', 'sessions')

/** Dollars per 1M tokens, deepseek-flash. */
const PRICES = {
  offPeak: { cacheHit: 0.003, cacheMiss: 0.15, output: 0.6 },
  peak: { cacheHit: 0.006, cacheMiss: 0.3, output: 1.2 },
}

const args = process.argv.slice(2)
const json = args.includes('--json')
const topIndex = args.indexOf('--top')
const top = topIndex >= 0 ? Number(args[topIndex + 1] ?? 20) : 20

function costOf(totals, tier) {
  const p = PRICES[tier]
  const miss = (totals.uncachedInputTokens ?? 0) / 1e6 * p.cacheMiss
  const hit = (totals.cacheReadTokens ?? 0) / 1e6 * p.cacheHit
  const out = (totals.outputTokens ?? 0) / 1e6 * p.output
  return { miss, hit, out, total: miss + hit + out }
}

let files
try {
  files = readdirSync(CACHE_DIR).filter((name) => name.endsWith('.json'))
} catch {
  console.error(`Projection directory not found: ${CACHE_DIR}`)
  process.exit(2)
}

const sessions = []
for (const name of files) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(join(CACHE_DIR, name), 'utf8'))
  } catch {
    continue
  }
  const totals = parsed?.record?.rows?.tokenUsage?.val?.totals
  if (!totals) continue

  const identity = parsed?.record?.identity ?? {}
  const title = parsed?.record?.rows?.title?.val
  const id = name.replace(/\.json$/, '')

  sessions.push({
    id,
    title: typeof title === 'string' ? title : '',
    isChild: !id.startsWith('session-'),
    cwd: identity.cwd ?? '',
    tokens: {
      cacheMiss: totals.uncachedInputTokens ?? 0,
      cacheHit: totals.cacheReadTokens ?? 0,
      output: totals.outputTokens ?? 0,
      cacheWrite: totals.cacheWriteTokens ?? 0,
    },
    offPeak: costOf(totals, 'offPeak'),
    peak: costOf(totals, 'peak'),
  })
}

sessions.sort((a, b) => b.offPeak.total - a.offPeak.total)

const sum = (pick) => sessions.reduce((acc, s) => acc + pick(s), 0)
const totals = {
  cacheMiss: sum((s) => s.tokens.cacheMiss),
  cacheHit: sum((s) => s.tokens.cacheHit),
  output: sum((s) => s.tokens.output),
  offPeak: sum((s) => s.offPeak.total),
  peak: sum((s) => s.peak.total),
}
const buckets = {
  output: sum((s) => s.offPeak.out),
  cacheMiss: sum((s) => s.offPeak.miss),
  cacheHit: sum((s) => s.offPeak.hit),
}

if (json) {
  console.log(JSON.stringify({ sessions, totals, buckets, prices: PRICES }, null, 2))
  process.exit(0)
}

console.log(`Projection directory: ${CACHE_DIR}`)
console.log(`Sessions with token data: ${sessions.length}\n`)

console.log('Most expensive sessions (at off-peak pricing):')
console.log('  cost        output tokens   cache miss   cache hit   type    title')
for (const s of sessions.slice(0, top)) {
  const kind = s.isChild ? 'child' : 'parent'
  const label = (s.title || s.id).slice(0, 42)
  console.log(
    `  $${s.offPeak.total.toFixed(4).padStart(8)}   ${String(s.tokens.output).padStart(12)}   ` +
      `${String(s.tokens.cacheMiss).padStart(11)}   ${String(s.tokens.cacheHit).padStart(15)}   ` +
      `${kind.padEnd(8)} ${label}`,
  )
}

const pct = (value) => `${((value / totals.offPeak) * 100).toFixed(1)}%`
console.log('\nTotals across all sessions:')
console.log(`  cache miss (input):   ${totals.cacheMiss.toLocaleString('ru-RU').padStart(14)} tokens   $${buckets.cacheMiss.toFixed(4)}   ${pct(buckets.cacheMiss)}`)
console.log(`  cache hit:            ${totals.cacheHit.toLocaleString('ru-RU').padStart(14)} tokens   $${buckets.cacheHit.toFixed(4)}   ${pct(buckets.cacheHit)}`)
console.log(`  model output:         ${totals.output.toLocaleString('ru-RU').padStart(14)} tokens   $${buckets.output.toFixed(4)}   ${pct(buckets.output)}`)
console.log(`  TOTAL at off-peak hours: $${totals.offPeak.toFixed(4)}`)
console.log(`  TOTAL at peak hours:     $${totals.peak.toFixed(4)}`)

console.log('\nSubagent tokens are counted separately: each child has its own session and its own')
console.log('row in the table, they are not included in the parent tokens.')
console.log('Peak hours: 01:00-04:00 and 06:00-10:00 UTC on weekdays (04:00-07:00 and 09:00-13:00 MSK).')
console.log('The rest of the time the price is twice lower — that is the largest saving available.')
