#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { scanDir, compare } from '../src/scan.js'
import { toText, toMarkdown } from '../src/format.js'
import { buildPlan, planToMarkdown } from '../src/plan.js'
import { gitSnapshots, buildAtlas } from '../src/atlas.js'
import { loadPack } from '../src/pack.js'

const USAGE = `chainguard - find legacy ethers v5 / web3.js usage and plan its migration to viem/wagmi

Usage:
  chainguard scan <dir> [--format text|json|md] [--out file] [--baseline report.json] [--fail-on error|warning|none] [--pack rules.json]
  chainguard plan <dir> [--format md|json] [--out file]
  chainguard atlas <dir> [--out file]      git history of <dir>, scanned per commit, for the Atlas UI
  chainguard rules [--pack rules.json]

--pack loads a rule pack (see chainguard/packs/); without it the built-in Web3 pack is used.

Exit codes: 0 ok, 1 findings at or above --fail-on severity, 2 usage error.`

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const opts = { _: [] }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a.startsWith('--')) opts[a.slice(2)] = rest[++i]
    else opts._.push(a)
  }
  return { cmd, opts }
}

function emit(content, out) {
  if (out) {
    writeFileSync(out, content.endsWith('\n') ? content : content + '\n')
    console.error(`chainguard: wrote ${out}`)
  } else {
    console.log(content)
  }
}

function main() {
  const { cmd, opts } = parseArgs(process.argv.slice(2))
  const dir = opts._[0]

  const pack = loadPack(opts.pack)
  if (cmd === 'rules') {
    console.log(`${pack.name}: ${pack.from} -> ${pack.to} (playbook ${pack.playbook})`)
    for (const r of pack.rules) console.log(`${r.id.padEnd(7)} ${r.severity.padEnd(7)} ${r.lib.padEnd(9)} ${r.title}  ->  ${r.replacement}`)
    return 0
  }
  if (!['scan', 'plan', 'atlas'].includes(cmd) || !dir) {
    console.error(USAGE)
    return 2
  }

  if (cmd === 'atlas') {
    const atlas = buildAtlas(gitSnapshots(dir, pack.rules), pack)
    emit(JSON.stringify(atlas), opts.out)
    return 0
  }

  const report = scanDir(dir, pack.rules)

  if (cmd === 'plan') {
    const plan = buildPlan(report, { scanPath: dir, pack })
    emit(opts.format === 'json' ? JSON.stringify(plan, null, 2) : planToMarkdown(plan), opts.out)
    return 0
  }

  const delta = opts.baseline ? compare(JSON.parse(readFileSync(opts.baseline, 'utf8')), report) : undefined
  const format = opts.format || 'text'
  const body =
    format === 'json' ? JSON.stringify(delta ? { ...report, delta } : report, null, 2)
    : format === 'md' ? toMarkdown(report, delta, pack)
    : toText(report, delta, pack)
  emit(body, opts.out)

  const failOn = opts['fail-on'] || 'none'
  if (failOn === 'error' && report.totals.errors > 0) return 1
  if (failOn === 'warning' && report.totals.findings > 0) return 1
  return 0
}

process.exitCode = main()
