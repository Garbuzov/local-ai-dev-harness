<#
.SYNOPSIS
  Installs the configured DeepSeek Harness kit: skills, agent presets with MCP server
  stubs, tools and the project templates. Global instructions are installed only if
  you put your own home\AGENTS.md into the kit.

.DESCRIPTION
  The script is idempotent: a repeated run updates the kit files and leaves
  everything else untouched. Everything that is overwritten is first copied to the backup
  folder $DshHome\_backup\harness-setup-<timestamp>\ — the previous state can be restored
  by simply copying from there.

  The script does NOT restart the application. Changes to cordis.patch.yml, the profile
  package.json and settings.yaml are applied on the next start; the preset set
  is picked up when a new session is created.

.PARAMETER DshHome
  Harness configuration directory. Defaults to $env:USERPROFILE\.dsh.

.PARAMETER ProjectsRoot
  Root for projects. Defaults to $env:USERPROFILE\AIProjects.

.PARAMETER SkipLiveReload
  Do not enable patchReload: live in the desktop profile manifest. Without it, edits to
  the patch files require restarting the application.

.EXAMPLE
  pwsh -File .\install.ps1
.EXAMPLE
  pwsh -File .\install.ps1 -ProjectsRoot 'D:\code' -SkipLiveReload
#>
[CmdletBinding()]
param(
    [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
    [string]$ProjectsRoot = (Join-Path $env:USERPROFILE 'AIProjects'),
    [switch]$SkipLiveReload
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$KitRoot = $PSScriptRoot
if (-not $KitRoot) { throw 'Could not determine the kit directory (PSScriptRoot is empty).' }

$stamp      = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $DshHome "_backup\harness-setup-$stamp"
$actions    = [System.Collections.Generic.List[string]]::new()

function Write-Step { param([string]$Text) Write-Host "  $Text" }
function Write-Head { param([string]$Text) Write-Host "`n=== $Text ===" -ForegroundColor Cyan }

# Copies a file, first saving the existing one to the backup folder.
function Install-File {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [Parameter(Mandatory)][string]$BackupKey
    )
    if (-not (Test-Path -LiteralPath $Source)) { throw "Source file not found: $Source" }

    if (Test-Path -LiteralPath $Destination) {
        $backupPath = Join-Path $backupRoot $BackupKey
        $backupDir  = Split-Path -Parent $backupPath
        if (-not (Test-Path -LiteralPath $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
        Copy-Item -LiteralPath $Destination -Destination $backupPath -Force
        $state = 'updated (previous version backed up)'
    } else {
        $state = 'created'
    }

    $destDir = Split-Path -Parent $Destination
    if (-not (Test-Path -LiteralPath $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    $actions.Add("$state : $Destination")
    Write-Step "$state -> $Destination"
}

Write-Head 'Environment check'
if (-not (Test-Path -LiteralPath $DshHome))            { throw "Harness directory not found: $DshHome" }
if (-not (Test-Path -LiteralPath (Join-Path $KitRoot 'home'))) { throw "Incomplete kit: no directory $KitRoot\home" }

$profilesDir = Join-Path $DshHome 'profiles'
if (-not (Test-Path -LiteralPath $profilesDir))        { throw "Profiles directory not found: $profilesDir" }

$shippedPresets = Join-Path $profilesDir 'node_modules\@deepseek-ai\dsh-agent-presets\presets'
$standardFile   = Join-Path $shippedPresets 'standard\agent.cordis.yml'
Write-Step "DSH_HOME       : $DshHome"
Write-Step "Kit            : $KitRoot"
Write-Step "Backup         : $backupRoot"
Write-Step "Projects       : $ProjectsRoot"

if (-not (Test-Path -LiteralPath $standardFile)) {
    throw "Shipped standard preset not found: $standardFile. The preset is assembled as its copy; installation is impossible without the file."
}

# ── 1. Global files ──────────────────────────────────────────────────────────
Write-Head 'Global instructions and patch'
Install-File -Source (Join-Path $KitRoot 'home\cordis.patch.yml') -Destination (Join-Path $DshHome 'cordis.patch.yml') -BackupKey 'cordis.patch.yml'
# AGENTS.md is not part of the kit: everyone has their own global instructions. If you put
# your own file into home\AGENTS.md, the installer will install it too.
$agentsSource = Join-Path $KitRoot 'home\AGENTS.md'
if (Test-Path -LiteralPath $agentsSource) {
    Install-File -Source $agentsSource -Destination (Join-Path $DshHome 'AGENTS.md') -BackupKey 'AGENTS.md'
} else {
    Write-Step 'home\AGENTS.md not found — global instructions were not installed'
}
# settings.yaml is deliberately NOT installed: the host application treats it as a one-off
# import (it renames it to settings.yaml.imported), so it is not a live settings
# document. The default preset is chosen in the UI: Settings -> General.

# ── 2. Skills ────────────────────────────────────────────────────────────────
Write-Head 'Skills (~/.dsh/skills)'
$skillsSource = Join-Path $KitRoot 'home\skills'
if (Test-Path -LiteralPath $skillsSource) {
    foreach ($skillDir in Get-ChildItem -LiteralPath $skillsSource -Directory) {
        $skillFile = Join-Path $skillDir.FullName 'SKILL.md'
        if (-not (Test-Path -LiteralPath $skillFile)) {
            Write-Warning "Skipped directory without SKILL.md: $($skillDir.FullName)"
            continue
        }
        Install-File -Source $skillFile `
                     -Destination (Join-Path $DshHome "skills\$($skillDir.Name)\SKILL.md") `
                     -BackupKey "skills\$($skillDir.Name)\SKILL.md"
    }
} else {
    Write-Warning "Skills directory not found: $skillsSource"
}

# ── 2b. Tools ────────────────────────────────────────────────────────────────
Write-Head 'Tools (~/.dsh/tools)'
$toolsSource = Join-Path $KitRoot 'home\tools'
if (Test-Path -LiteralPath $toolsSource) {
    foreach ($toolFile in Get-ChildItem -LiteralPath $toolsSource -File) {
        Install-File -Source $toolFile.FullName `
                     -Destination (Join-Path $DshHome "tools\$($toolFile.Name)") `
                     -BackupKey "tools\$($toolFile.Name)"
    }
} else {
    Write-Warning "Tools directory not found: $toolsSource"
}

# ── 3. Agent presets ─────────────────────────────────────────────────────────
# Each subdirectory home\.agent-presets\<id> is one preset. There are several of them
# because the MCP price is paid in every request: a light default preset and a full
# one for live-interface tasks. The preset id = the directory name.
Write-Head 'Agent presets'
$presetsSource = Join-Path $KitRoot 'home\.agent-presets'
if (-not (Test-Path -LiteralPath $presetsSource)) { throw "Presets directory not found: $presetsSource" }

$standardText = Get-Content -LiteralPath $standardFile -Raw
$presetIds = [System.Collections.Generic.List[string]]::new()

# A preset has no mechanism of its own to override a row coming from the shipped package,
# so we edit the text of the copy — checking that the anchor is found. If the shipped
# package changes, the installation fails with a clear reason instead of staying silent
# and shipping a preset with the old values.
$rowOverrides = @(
    @{
        Name = 'tool-web: one search query instead of four'
        From = "    fetch: true`n    searchTimeoutMs: 60000"
        To   = "    fetch: true`n    searchTimeoutMs: 60000`n    searchMaxQueries: 1"
    },
    @{
        # tool-ralph sits inside the `delegation` group, hence the 8-space indent.
        Name = 'tool-ralph: 4 rounds instead of 64'
        From = "        subagentProvider: spawn`n        maxRounds: 64"
        To   = "        subagentProvider: spawn`n        maxRounds: 4"
    },
    @{
        # The main cost in a long session is not the tools but the context size
        # multiplied by the number of requests: in the measured session 31.4M cache read
        # against 503K of regular input. Built-in compaction starts at 0.8 of the window,
        # that is at 800,000 tokens, and in that session it never triggered once —
        # the context grew to 409,675 and kept growing. We lower the threshold: compaction at
        # 0.25 of the window (250,000), after compaction 0.08 (80,000) remains verbatim.
        # The row sits inside the `compaction` group, hence the 4-space indent for
        # `- id`, 6 for `name` and 8 for the config keys.
        Name = 'compaction-basic: compaction at 250k instead of 800k'
        From = "    - id: compaction-basic`n      name: '@deepseek-ai/dsh-compaction-basic'"
        To   = "    - id: compaction-basic`n      name: '@deepseek-ai/dsh-compaction-basic'`n      config:`n        thresholdRatio: 0.25`n        retainRatio: 0.08"
    }
)
foreach ($rowOverride in $rowOverrides) {
    if (-not $standardText.Contains($rowOverride.From)) {
        throw "Anchor for the override '$($rowOverride.Name)' not found: the shipped standard preset changed, check manually."
    }
    $standardText = $standardText.Replace($rowOverride.From, $rowOverride.To)
    Write-Step "override: $($rowOverride.Name)"
}

foreach ($presetDir in Get-ChildItem -LiteralPath $presetsSource -Directory) {
    $presetId     = $presetDir.Name
    $presetSource = $presetDir.FullName
    $presetTarget = Join-Path $DshHome ".agent-presets\$presetId"
    $appendFile   = Join-Path $presetSource 'agent.append.yml'
    $presetIds.Add($presetId)

    if (-not (Test-Path -LiteralPath $appendFile)) { throw "MCP rows block not found: $appendFile" }

    # Preset metadata.
    Install-File -Source (Join-Path $presetSource 'preset.yml') `
                 -Destination (Join-Path $presetTarget 'preset.yml') `
                 -BackupKey ".agent-presets\$presetId\preset.yml"

    # Composition = a copy of the shipped standard + our block. A copy, not a link: the preset
    # must be a self-contained file that can be edited without touching the shipped package.
    $compositionTarget = Join-Path $presetTarget 'agent.cordis.yml'
    if (Test-Path -LiteralPath $compositionTarget) {
        $backupPath = Join-Path $backupRoot ".agent-presets\$presetId\agent.cordis.yml"
        $backupDir  = Split-Path -Parent $backupPath
        if (-not (Test-Path -LiteralPath $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
        Copy-Item -LiteralPath $compositionTarget -Destination $backupPath -Force
        Write-Step "previous version backed up -> $backupPath"
    }
    if (-not (Test-Path -LiteralPath $presetTarget)) { New-Item -ItemType Directory -Path $presetTarget -Force | Out-Null }

    $appendText = Get-Content -LiteralPath $appendFile -Raw
    # -NoNewline is required: without it Set-Content appends an extra CRLF at the end,
    # and the assembled file is no longer byte-for-byte equal to "standard + MCP block".
    Set-Content -LiteralPath $compositionTarget -Value ($standardText.TrimEnd() + "`n" + $appendText) -Encoding utf8NoBOM -NoNewline
    $actions.Add("assembled : $compositionTarget (copy of standard + MCP block)")
    Write-Step "assembled -> $compositionTarget"

    # A copy of the block next to the composition: to see exactly what the installer added.
    Install-File -Source $appendFile -Destination (Join-Path $presetTarget 'agent.append.yml') `
                 -BackupKey ".agent-presets\$presetId\agent.append.yml"
}

# ── 4. Live reload of desktop profile patch files ────────────────────────────
Write-Head 'Desktop profile'
$manifestPath = Join-Path $profilesDir 'desktop\package.json'
if ($SkipLiveReload) {
    Write-Step 'skipped (-SkipLiveReload): edits to the patch files require restarting the application'
} elseif (-not (Test-Path -LiteralPath $manifestPath)) {
    Write-Warning "Profile manifest not found: $manifestPath — live reload not enabled"
} else {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    # Set-StrictMode forbids reading a missing property, and patchReload
    # is not set in the desktop profile manifest initially.
    $profileNode = $manifest.dsh.profile
    $hasKey = $profileNode.PSObject.Properties.Name -contains 'patchReload'
    $current = if ($hasKey) { [string]$profileNode.patchReload } else { '(not set)' }
    if ($current -eq 'live') {
        Write-Step 'patchReload is already live — nothing to change'
    } else {
        $backupPath = Join-Path $backupRoot 'profiles\desktop\package.json'
        $backupDir  = Split-Path -Parent $backupPath
        if (-not (Test-Path -LiteralPath $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
        Copy-Item -LiteralPath $manifestPath -Destination $backupPath -Force

        $manifest.dsh.profile | Add-Member -NotePropertyName patchReload -NotePropertyValue 'live' -Force
        $manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM
        $actions.Add("updated : $manifestPath (dsh.profile.patchReload = live)")
        Write-Step "patchReload: $current -> live (takes effect after the application restarts)"
    }
}

# ── 5. Project templates ─────────────────────────────────────────────────────
Write-Head "Projects ($ProjectsRoot)"
if (-not (Test-Path -LiteralPath $ProjectsRoot)) {
    New-Item -ItemType Directory -Path $ProjectsRoot -Force | Out-Null
    $actions.Add("created : $ProjectsRoot")
    Write-Step "created -> $ProjectsRoot"
}

# Copies the whole tree, creating the missing directories.
# node_modules, dist and .env are not part of the kit: dependencies are installed by `pnpm install`.
function Install-Tree {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [Parameter(Mandatory)][string]$Label
    )
    if (-not (Test-Path -LiteralPath $Source)) {
        Write-Warning "Not found: $Source — '$Label' was not installed"
        return
    }
    if (-not (Test-Path -LiteralPath $Destination)) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }
    Get-ChildItem -LiteralPath $Source -Recurse -File | ForEach-Object {
        $relative  = $_.FullName.Substring($Source.Length).TrimStart('\')
        $target    = Join-Path $Destination $relative
        $targetDir = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
    $actions.Add("updated : $Destination ($Label)")
    Write-Step "updated -> $Destination ($Label)"
}

Install-Tree -Source (Join-Path $KitRoot 'project-scaffold') `
             -Destination (Join-Path $ProjectsRoot '_template') `
             -Label 'React + TypeScript scaffold'
Install-Tree -Source (Join-Path $KitRoot 'project-template') `
             -Destination (Join-Path $ProjectsRoot '_template-blank') `
             -Label 'blank AGENTS.md template'

# ── 6. Preset check ──────────────────────────────────────────────────────────
Write-Head 'Preset check'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
$profilesNodeModules = Join-Path $profilesDir 'node_modules'
if (-not $node) {
    Write-Warning 'node not found in PATH — preset check skipped'
} elseif (-not (Test-Path -LiteralPath (Join-Path $profilesNodeModules 'js-yaml'))) {
    Write-Warning "js-yaml not found in $profilesNodeModules — YAML check skipped"
} else {
    # 6a. Every preset's YAML parses and contains no duplicate ids. Arguments:
    # [2] — the presets directory, [3] — the profile node_modules (require('js-yaml')
    # does not resolve from a file in %TEMP%, so the path is absolute). The !!js tag
    # is expanded by the DSH loader; the regular js-yaml schema fails on it — we declare
    # it as a scalar, the value is not needed here.
    $check = @'
const fs = require('node:fs');
const path = require('node:path');
const base = require(path.join(process.argv[3], 'js-yaml'));
const jsTag = new base.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: (d) => d });
const schema = base.DEFAULT_SCHEMA.extend([jsTag]);
const root = process.argv[2];
let failed = 0;
for (const id of fs.readdirSync(root)) {
  const file = path.join(root, id, 'agent.cordis.yml');
  if (!fs.existsSync(file)) { console.log(`  SKIPPED ${id}: no agent.cordis.yml`); failed++; continue; }
  let rows;
  try {
    rows = base.load(fs.readFileSync(file, 'utf8'), { schema });
  } catch (error) {
    console.log(`  BROKEN ${id}: YAML does not parse — ${error.message}`); failed++; continue;
  }
  if (!Array.isArray(rows)) { console.log(`  BROKEN ${id}: the composition is not a list of rows`); failed++; continue; }
  const ids = rows.map((row) => row && row.id).filter(Boolean);
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (dupes.length) { console.log(`  BROKEN ${id}: duplicate ids — ${dupes.join(', ')}`); failed++; continue; }
  const mcp = rows.filter((row) => row.name === '@deepseek-ai/dsh-mcp-client');
  const active = mcp.filter((row) => row.disabled !== true);
  console.log(`  ok      ${id}: ${rows.length} rows, MCP enabled ${active.length} of ${mcp.length}`);
}
process.exit(failed ? 1 : 0);
'@
    $checkFile = Join-Path ([System.IO.Path]::GetTempPath()) "dsh-preset-check-$stamp.cjs"
    Set-Content -LiteralPath $checkFile -Value $check -Encoding utf8NoBOM
    try {
        $result = & $node $checkFile (Join-Path $DshHome '.agent-presets') $profilesNodeModules 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Preset compositions failed the check:`n$result" }
        $result | ForEach-Object { Write-Step $_ }
    } finally {
        Remove-Item -LiteralPath $checkFile -Force -ErrorAction SilentlyContinue
    }

    # 6b. Health check with the same code that fills the preset list in the UI:
    # it parses the compositions and resolves package names without importing the plugins.
    $validator = Join-Path $DshHome 'tools\validate-preset.mjs'
    if (Test-Path -LiteralPath $validator) {
        $env:DSH_HOME = $DshHome
        try {
            $health = & $node $validator (Join-Path $DshHome '.agent-presets') 2>&1
            if ($LASTEXITCODE -ne 0) { throw "Presets failed the health check:`n$health" }
            $health | Where-Object { $_ -match 'ok|BROKEN|Presets found|All presets' } | ForEach-Object { Write-Step $_ }
        } finally {
            Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue
        }
    } else {
        Write-Warning "Preset validator not found: $validator"
    }
}

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Head 'Done'
$actions | ForEach-Object { Write-Host "  - $_" }
Write-Host @"

Next steps:
  1. Restart the DeepSeek Harness application so that cordis.patch.yml,
     the local model route and patchReload take effect.
  2. The default preset is set by the patch (frontend, light). Another one is chosen in the UI:
     Settings -> General -> agent preset. This is not set by the settings.yaml file —
     the host application imports it and renames it to .imported.
  3. Create a NEW session. To work with the live interface use the frontend-full preset:
     it enables chrome-devtools, playwright and memory.
  4. The subagent_local subagent runs on a local model in Ollama and requires
     a running Ollama application. Check: `ollama list` responds.
  5. The MCP composition is edited in home\.agent-presets\<id>\agent.append.yml followed by
     running install.ps1, or directly in ~/.dsh/.agent-presets/<id>/agent.cordis.yml
     (it applies immediately, but the next installation will overwrite it).
  6. Check the price of the enabled MCP: node ~/.dsh/tools/measure-mcp-tools.mjs

Rollback:
  Copy-Item -Recurse -Force "$backupRoot\*" "$DshHome\"
  (delete files that did not exist before by hand: they are listed above as "created")

Backup: $backupRoot
"@ -ForegroundColor Green
