#!/usr/bin/env node
// Cross-platform `npm run atlas`: scan history, export the ledger if there is one, build the panel.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
run('npm run data --prefix atlas')
if (existsSync('.signalbox/ledger.jsonl')) run('node chainguard/bin/signalbox.js export')
run('npm run build --prefix atlas')
