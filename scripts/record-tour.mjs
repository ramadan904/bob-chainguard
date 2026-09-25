#!/usr/bin/env node
// Records the guided replay (or the deck) as a 1920×1080 video for the demo edit.
//   npm run record:tour            the ?tour replay of the recorded run, until the tour ends
//   npm run record:tour -- --deck  every deck slide, 5 s each
// Serves atlas/dist itself, so run `npm run atlas` (or `npm run finalize`) first. Needs Playwright:
//   npm i --no-save playwright && npx playwright install chromium
// Writes docs/submission/media/tour.webm (or deck.webm), plus .mp4 when ffmpeg is on the PATH.

import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, mkdirSync, renameSync, rmSync, readdirSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { spawnSync, execSync } from 'node:child_process'

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
const dist = join(root, 'atlas', 'dist')
const deck = process.argv.includes('--deck')
const name = deck ? 'deck' : 'tour'
const outDir = join(root, 'docs', 'submission', 'media')

let chromium
try {
  ({ chromium } = await import('playwright'))
} catch {
  console.error('Playwright is not installed. Run:\n  npm i --no-save playwright && npx playwright install chromium\nthen run this again.')
  process.exit(2)
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error('atlas/dist is missing. Run `npm run atlas` (or `npm run finalize`) first.')
  process.exit(2)
}
if (!deck && !existsSync(join(root, 'atlas', 'src', 'data', 'ledger.json'))) {
  console.error('No recorded run in the panel yet (atlas/src/data/ledger.json). The tour needs the Bob run: `npm run finalize` first.')
  process.exit(2)
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '') || 'index.html'
  const file = join(dist, rel)
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404)
    return res.end()
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

const tmp = join(outDir, `.rec-${Date.now()}`)
mkdirSync(tmp, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } }, colorScheme: 'dark' })
const page = await context.newPage()
const t0 = Date.now()
if (deck) {
  await page.goto(`${base}/deck.html#1`)
  const total = await page.$$eval('.slide', (s) => s.length)
  for (let i = 0; i < total; i++) {
    await page.waitForTimeout(5000)
    if (i < total - 1) await page.keyboard.press('ArrowRight')
  }
} else {
  await page.goto(`${base}/?tour`)
  await page.waitForFunction(() => document.body.classList.contains('touring'), null, { timeout: 15000 })
  // The tour removes `touring` when it ends (after its closing caption).
  await page.waitForFunction(() => !document.body.classList.contains('touring'), null, { timeout: 10 * 60e3, polling: 500 })
  await page.waitForTimeout(800)
}
await context.close()
await browser.close()
server.close()

const webm = join(outDir, `${name}.webm`)
const recorded = readdirSync(tmp).find((f) => f.endsWith('.webm'))
renameSync(join(tmp, recorded), webm)
rmSync(tmp, { recursive: true, force: true })
console.log(`recorded ${Math.round((Date.now() - t0) / 1000)} s → ${webm}`)

const mp4 = join(outDir, `${name}.mp4`)
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', mp4], { stdio: 'inherit' })
if (ff.status === 0) console.log(`converted → ${mp4}`)
else console.log('ffmpeg not found: the .webm plays in browsers and most editors (or convert it at any online converter).')
