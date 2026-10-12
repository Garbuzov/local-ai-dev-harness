#!/usr/bin/env node
/**
 * Measures how much enabling MCP servers costs: it connects to every active
 * server from the preset, fetches the tool list and counts how many characters
 * (and therefore tokens) go into EVERY request to the model.
 *
 * Why: an enabled MCP server is not a subscription but a permanent surcharge on every
 * request. The tool shows it in numbers so you can disable the excess deliberately.
 *
 * Usage:
 *   node measure-mcp-tools.mjs [path-to-agent.cordis.yml] [--json]
 *
 * By default it takes the frontend preset from ~/.dsh/.agent-presets/frontend/agent.cordis.yml.
 * `!!js` values are expanded the same way the DSH loader expands them: otherwise
 * the memory server would get the wrong working directory and create a file in the wrong place.
 *
 * Important: the tool STARTS the listed servers — the same processes the harness
 * starts. Run it only for your own preset.
 *
 * Exit code: 0 — measurement completed (even if an individual server did not come up),
 *            2 — invocation error or preset file read error.
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const PROFILES_MODULES = join(DSH_HOME, 'profiles', 'node_modules')
const SDK_ROOT = join(PROFILES_MODULES, '@modelcontextprotocol', 'sdk', 'dist', 'esm')

/** Rough estimate: English JSON schema text is about 4 characters per token. */
const CHARS_PER_TOKEN = 4

function loadYaml(text) {
  const yaml = require(join(PROFILES_MODULES, 'js-yaml'))
  const jsTag = new yaml.Type('tag:yaml.org,2002:js', {
    kind: 'scalar',
    // Tag the values so they can later be told apart from ordinary strings.
    construct: (value) => ({ __js: String(value) }),
  })
  return yaml.load(text, { schema: yaml.DEFAULT_SCHEMA.extend([jsTag]) })
}

/** Expands a `!!js` expression the same way the configuration loader does. */
function resolveValue(value) {
  if (value && typeof value === 'object' && typeof value.__js === 'string') {
    try {
      // eslint-disable-next-line no-new-func
      return new Function('process', `return (${value.__js})`)(process)
    } catch (error) {
      throw new Error(`failed to evaluate the !!js expression "${value.__js}": ${String(error)}`)
    }
  }
  return value
}

function resolveEnv(env) {
  if (!env || typeof env !== 'object') return undefined
  const out = {}
  for (const [key, value] of Object.entries(env)) {
    out[key] = String(resolveValue(value) ?? '')
  }
  return out
}

async function measureServer(entry, sdk) {
  const config = entry.config ?? {}
  const label = String(config.serverName ?? entry.id)
  const result = {
    id: entry.id,
    serverName: label,
    transport: config.transport,
    ok: false,
    tools: 0,
    chars: 0,
    error: null,
  }

  if (config.transport !== 'stdio') {
    result.error = 'only stdio servers are measured'
    return result
  }

  // stderr: 'ignore' — we do not capture the server output, we do not need it.
  const transportOptions = { stderr: 'ignore' }
  transportOptions.command = String(resolveValue(config.command))
  transportOptions.args = (config.args ?? []).map((arg) => String(resolveValue(arg)))
  const env = resolveEnv(config.env)
  if (env) transportOptions.env = { ...process.env, ...env }
  const cwd = resolveValue(config.cwd)
  if (typeof cwd === 'string' && cwd.length > 0) transportOptions.cwd = cwd

  const transport = new sdk.StdioClientTransport(transportOptions)
  const client = new sdk.Client({ name: 'dsh-measure-mcp', version: '1.0.0' })

  try {
    await client.connect(transport)
    const listed = await client.listTools()
    const tools = listed.tools ?? []
    result.tools = tools.length
    result.chars = JSON.stringify(tools).length
    result.ok = true
  } catch (error) {
    result.error = String(error instanceof Error ? error.message : error).slice(0, 200)
  } finally {
    try {
      await client.close()
    } catch {
      /* the server may already be dead — that is not a measurement error */
    }
  }

  return result
}

async function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const target = resolve(
    args.find((arg) => !arg.startsWith('--')) ??
      join(DSH_HOME, '.agent-presets', 'frontend', 'agent.cordis.yml'),
  )

  let rows
  try {
    rows = loadYaml(readFileSync(target, 'utf8'))
  } catch (error) {
    console.error(`Failed to read preset ${target}: ${String(error)}`)
    process.exit(2)
  }

  if (!Array.isArray(rows)) {
    console.error(`Preset ${target} is not a list of composition rows`)
    process.exit(2)
  }

  const mcpRows = rows.filter((row) => row?.name === '@deepseek-ai/dsh-mcp-client')
  const active = mcpRows.filter((row) => row.disabled !== true)
  const off = mcpRows.filter((row) => row.disabled === true)

  const sdk = {
    Client: (await import(pathToFileURL(join(SDK_ROOT, 'client', 'index.js')).href)).Client,
    StdioClientTransport: (await import(pathToFileURL(join(SDK_ROOT, 'client', 'stdio.js')).href))
      .StdioClientTransport,
  }

  const measured = []
  for (const row of active) {
    measured.push(await measureServer(row, sdk))
  }

  const totalTools = measured.reduce((sum, item) => sum + item.tools, 0)
  const totalChars = measured.reduce((sum, item) => sum + item.chars, 0)

  if (json) {
    console.log(
      JSON.stringify(
        {
          preset: target,
          measured,
          disabled: off.map((row) => row.id),
          totals: {
            tools: totalTools,
            chars: totalChars,
            approxTokens: Math.round(totalChars / CHARS_PER_TOKEN),
          },
        },
        null,
        2,
      ),
    )
    process.exit(0)
  }

  console.log(`Preset: ${target}`)
  console.log(`Active MCP servers: ${active.length}, disabled: ${off.length}\n`)

  for (const item of measured) {
    if (item.ok) {
      const tokens = Math.round(item.chars / CHARS_PER_TOKEN)
      console.log(
        `  ${item.serverName.padEnd(18)} tools: ${String(item.tools).padStart(3)}   ` +
          `schema chars: ${String(item.chars).padStart(7)}   ~${tokens} tokens per request`,
      )
    } else {
      console.log(`  ${item.serverName.padEnd(18)} NOT MEASURED: ${item.error}`)
    }
  }

  for (const row of off) {
    console.log(`  ${String(row.config?.serverName ?? row.id).padEnd(18)} disabled`)
  }

  console.log(
    `\nTotal surcharge per request: ~${Math.round(totalChars / CHARS_PER_TOKEN)} tokens ` +
      `(${totalTools} tools, ${totalChars} characters).`,
  )
  console.log('Estimate at 4 characters per token: for schemas with English text that is close to the truth,')
  console.log('but only the token counter in the session itself gives the exact number.')
  console.log('\nDisable the servers you do not use in the current task: the surcharge is paid always.')
}

main().catch((error) => {
  console.error(String(error))
  process.exit(2)
})
