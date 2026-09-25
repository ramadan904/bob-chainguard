#!/usr/bin/env node
// Helpers around the real IBM Bob run. They never edit legacy-dapp/src: Bob does the migration.
//   npm run bob:prep   before Bob: machine check, dependencies, tests, tag before-bob, first prompts
//   npm run bob:open   after Bob's expand commit: open the signal box, guard, doctor, live panel
//   npm run bob:retake after a failed take: back to the expand commit with a fresh signal box
// Prompts are read from docs/BOB_RUNBOOK.md, so there is one source for them.

import { execSync, spawnSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, copyFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { promptFrom } from '../chainguard/src/statements.js'

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
const cmd = process.argv[2]
const ok = (m) => console.log(`  ok    ${m}`)
const warn = (m) => console.log(`  WARN  ${m}`)
const fail = (m) => { console.log(`  FAIL  ${m}`); process.exitCode = 1 }
const sh = (c, opts = {}) => spawnSync(c, { shell: true, cwd: root, stdio: 'inherit', ...opts })
const quiet = (c) => spawnSync(c, { shell: true, cwd: root, encoding: 'utf8' })

function show(title, text) {
  const bar = '─'.repeat(Math.min(78, title.length + 4))
  console.log(`\n┌${bar}\n│ ${title}\n└${bar}\n${text}\n`)
}

const runbook = readFileSync(join(root, 'docs/BOB_RUNBOOK.md'), 'utf8')

if (cmd === 'prep') {
  console.log('Before the Bob run\n')
  const [major] = process.versions.node.split('.').map(Number)
  major >= 20 ? ok(`Node.js ${process.versions.node}`) : fail(`Node.js ${process.versions.node}: install Node 20 or newer (22 LTS recommended)`)
  const dirty = quiet('git status --porcelain').stdout.trim()
  dirty ? warn(`uncommitted changes:\n${dirty.split('\n').map((l) => `          ${l}`).join('\n')}`) : ok('working tree clean')
  if (!existsSync(join(root, '.env')) && existsSync(join(root, '.env.example'))) {
    copyFileSync(join(root, '.env.example'), join(root, '.env'))
    ok('.env created from .env.example (it is gitignored)')
  }
  for (const dir of ['legacy-dapp', 'atlas', 'samples/moment-billing']) {
    if (existsSync(join(root, dir, 'node_modules'))) ok(`${dir} dependencies installed`)
    else if (sh(`npm ci --prefix ${dir} --no-audit --no-fund`).status === 0) ok(`${dir} dependencies installed`)
    else fail(`npm ci --prefix ${dir} failed`)
  }
  console.log('\n  running every test suite…')
  if (sh('npm test', { stdio: ['ignore', 'ignore', 'inherit'] }).status === 0) ok('all tests pass (tooling, dApp behavior, panel, sample)')
  else fail('tests fail: fix before starting Bob (run `npm test` to see why)')
  const src = quiet('git log --format=%h -- legacy-dapp/src').stdout.trim().split('\n').filter(Boolean)
  src.length === 1 ? ok('legacy-dapp/src is the untouched "before" code') : warn(`legacy-dapp/src has ${src.length} commits: is this a retake? See the bottom of docs/BOB_RUNBOOK.md`)
  if (quiet('git rev-parse -q --verify refs/tags/before-bob').status === 0) ok('tag before-bob exists')
  else if (quiet('git tag before-bob').status === 0) ok('tagged this commit before-bob (push it: git push origin before-bob)')
  else fail('could not create tag before-bob')
  if (process.exitCode) {
    console.log('\nFix the FAIL lines above, then run npm run bob:prep again.')
  } else {
    show('Paste into Bob (Agent mode): onboarding, document understanding', promptFrom(runbook, '1.'))
    show('Then paste into Bob (Agent mode): the expand step', promptFrom(runbook, '0.'))
    console.log('Screenshot each Bob session summary into bob_sessions/ (e.g. yourname-onboarding.png, yourname-expand.png).')
    console.log('When Bob has committed the expand step, run:  npm run bob:open')
  }
} else if (cmd === 'open') {
  console.log('Open the signal box\n')
  const pkg = JSON.parse(readFileSync(join(root, 'legacy-dapp/package.json'), 'utf8'))
  const expanded = pkg.dependencies?.viem && existsSync(join(root, 'legacy-dapp/src/lib/viem.js'))
  // Opening the box before the expand step deadlocks wave 2 (callers need lib/viem.js to exist).
  if (expanded) ok('expand step is in: viem is a dependency and src/lib/viem.js exists')
  else if (process.argv.includes('--force')) warn('expand step not found; opening anyway (--force)')
  else {
    fail('expand step not found (no viem dependency or src/lib/viem.js). Give Bob the expand prompt first: npm run bob:prep prints it')
    process.exit()
  }
  if (existsSync(join(root, 'legacy-dapp/node_modules')) && expanded && !existsSync(join(root, 'legacy-dapp/node_modules/viem'))) {
    sh('npm install --prefix legacy-dapp --no-audit --no-fund')
  }
  if (existsSync(join(root, '.signalbox/ledger.jsonl'))) ok('signal box already open (.signalbox/ledger.jsonl)')
  else if (sh('node chainguard/bin/signalbox.js init').status === 0) ok('signal box opened')
  else fail('signalbox init failed')
  sh('node chainguard/bin/signalbox.js install-hook')
  console.log('')
  if (sh('node chainguard/bin/signalbox.js doctor').status !== 0) fail('doctor found a problem: fix it before recording')
  if (process.exitCode) process.exit()
  show('Paste into Bob (Agent mode, subagents / parallel tasks on): the dispatcher', promptFrom(runbook, '2. The dispatcher'))
  console.log('Optional: connect the MCP tools first (docs/BOB_MCP.md) so Bob calls signalbox_claim / signalbox_release directly.')
  console.log('During wave 1, between two releases: click ⚡ Simulate chaos in the panel (or npm run -s sb -- drill spad --hold 6).')
  console.log('\nStarting the live panel at http://localhost:4700  (Ctrl+C to stop; the ledger keeps everything)\n')
  spawn('npm run signalbox', { shell: true, cwd: root, stdio: 'inherit' })
} else if (cmd === 'retake') {
  // Back to Bob's expand commit with a fresh signal box: code and ledger go back together, so the
  // replay never shows events the commits don't have. The attempt is kept on a branch.
  const expand = quiet("git log --grep=^Expand -n 1 --format=%H").stdout.trim()
  if (!expand) {
    fail('no "Expand: ..." commit found: nothing to go back to (run bob:prep and the expand step first)')
    process.exit()
  }
  const since = quiet(`git rev-list --count ${expand}..HEAD`).stdout.trim()
  const dirty = quiet('git status --porcelain --untracked-files=no').stdout.trim()
  console.log(`Retake: back to ${expand.slice(0, 7)} ${quiet(`git log -1 --format=%s ${expand}`).stdout.trim()}`)
  console.log(`  ${since} commit(s) after it will leave this branch (kept on a practice branch)`)
  if (dirty) console.log(`  uncommitted changes that will be discarded:\n${dirty.split('\n').map((l) => `    ${l}`).join('\n')}`)
  if (!process.argv.includes('--yes')) {
    console.log('\nNothing changed. To do it: npm run bob:retake -- --yes')
    process.exit()
  }
  const stamp = new Date().toISOString().slice(11, 16).replace(':', '')
  quiet(`git branch practice-${stamp}`).status === 0 ? ok(`attempt kept on branch practice-${stamp}`) : warn('could not create the practice branch (name taken?)')
  sh(`git reset --hard ${expand}`).status === 0 ? ok('code reset to the expand commit') : fail('git reset failed')
  sh('node chainguard/bin/signalbox.js init --force', { stdio: 'ignore' }).status === 0 ? ok('fresh signal box (old ledger archived in .signalbox/)') : fail('signalbox init failed')
  rmSync(join(root, '.signalbox', 'checkpoints'), { recursive: true, force: true })
  ok('black-box checkpoints cleared')
  console.log('')
  sh('node chainguard/bin/signalbox.js doctor')
  console.log('\nReload the panel (or restart npm run bob:open), then paste the dispatcher prompt into Bob again.')
} else {
  console.log('usage: npm run bob:prep | npm run bob:open | npm run bob:retake [-- --yes]')
  process.exitCode = 2
}
