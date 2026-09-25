#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { scanDir, compare } from '../src/scan.js'
import { toText, toMarkdown } from '../src/format.js'
import { buildPlan, planToMarkdown } from '../src/plan.js'
import { RULES } from '../src/rules.js'

const USAGE = `chainguard - find legacy ethers v5 / web3.js usage and plan its migration to viem/wagmi

Usage:
  chainguard scan <dir> [--format text|json|md] [--out file] [--baseline report.json] [--fail-on error|warning|none]
  chainguard plan <dir> [--format md|json] [--out file]
  chainguard rules

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

  if (cmd === 'rules') {
    for (const r of RULES) console.log(`${r.id.padEnd(7)} ${r.severity.padEnd(7)} ${r.lib.padEnd(9)} ${r.title}  ->  ${r.replacement}`)
    return 0
  }
  if (!['scan', 'plan'].includes(cmd) || !dir) {
    console.error(USAGE)
    return 2
  }

  const report = scanDir(dir)

  if (cmd === 'plan') {
    const plan = buildPlan(report, { scanPath: dir })
    emit(opts.format === 'json' ? JSON.stringify(plan, null, 2) : planToMarkdown(plan), opts.out)
    return 0
  }

  const delta = opts.baseline ? compare(JSON.parse(readFileSync(opts.baseline, 'utf8')), report) : undefined
  const format = opts.format || 'text'
  const body =
    format === 'json' ? JSON.stringify(delta ? { ...report, delta } : report, null, 2)
    : format === 'md' ? toMarkdown(report, delta)
    : toText(report, delta)
  emit(body, opts.out)

  const failOn = opts['fail-on'] || 'none'
  if (failOn === 'error' && report.totals.errors > 0) return 1
  if (failOn === 'warning' && report.totals.findings > 0) return 1
  return 0
}

process.exitCode = main()
