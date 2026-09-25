#!/usr/bin/env node
// Cross-platform `npm run atlas`: scan history, export the ledger if there is one, publish the Bob
// session screenshots, build the panel.
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, mkdirSync, copyFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { shotCaption } from '../chainguard/src/statements.js'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
run('npm run data --prefix atlas')
if (existsSync('.signalbox/ledger.jsonl')) run('node chainguard/bin/signalbox.js export')

// bob_sessions/*.png -> atlas/public/bob/ + atlas/src/data/bob-shots.json ("Bob at work").
const shots = existsSync('bob_sessions') ? readdirSync('bob_sessions').filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort() : []
rmSync(join('atlas', 'public', 'bob'), { recursive: true, force: true })
if (shots.length) mkdirSync(join('atlas', 'public', 'bob'), { recursive: true })
for (const f of shots) copyFileSync(join('bob_sessions', f), join('atlas', 'public', 'bob', f))
const manifest = shots.map((f) => ({ src: `bob/${f}`, ...shotCaption(f) })).sort((a, b) => a.order - b.order || a.src.localeCompare(b.src))
writeFileSync(join('atlas', 'src', 'data', 'bob-shots.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`bob_sessions: ${shots.length} screenshot${shots.length === 1 ? '' : 's'} published`)

run('npm run build --prefix atlas')
