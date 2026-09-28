#!/usr/bin/env node
// Records the guided replay (or the deck) as a 1920×1080 video for the demo edit.
//   npm run record:tour            the ?tour replay of the recorded run, until the tour ends
//   npm run record:tour -- --deck  every deck slide, 5 s each
//   npm run record:proof           the safety proof replay (about 30 s), until its verdict
//   npm run record:demo            the whole ~90 s demo video with on-screen captions: the pain
//                                  hook, the Control Tower, "simulate bad agent", the proof, the close
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
const demo = process.argv.includes('--demo')
const proof = process.argv.includes('--proof') || demo
const name = deck ? 'deck' : demo ? 'demo' : proof ? 'proof' : 'tour'
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
if (proof && !existsSync(join(root, 'atlas', 'src', 'data', 'proof.json'))) {
  console.error('No recorded safety proof (atlas/src/data/proof.json). Run `npm run atlas` first.')
  process.exit(2)
}
if (!deck && !proof && !existsSync(join(root, 'atlas', 'src', 'data', 'ledger.json'))) {
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
// On-screen captions for the demo video (it has no voice-over; record one on top if you like).
const CARD = (lines) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#050912;color:#edf1fb;font-family:'IBM Plex Sans Condensed','Arial Narrow',sans-serif}
  body{display:grid;place-content:center;gap:22px;padding:0 180px}
  p{margin:0;opacity:0;font-weight:600;letter-spacing:-.01em;animation:in .8s ease-out forwards}
  p.big{font-size:84px;line-height:1.05;color:#ff8a95}
  p.small{font-size:46px;line-height:1.2;color:#a9b3c9}
  @keyframes in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
</style>${lines.map(([cls, t, d]) => `<p class="${cls}" style="animation-delay:${d}s">${t}</p>`).join('')}`
async function caption(text, ms) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-cap')
    if (!el) {
      el = document.createElement('div')
      el.id = 'demo-cap'
      el.style.cssText = 'position:fixed;left:50%;bottom:56px;transform:translateX(-50%);z-index:90;max-width:1500px;padding:18px 30px;border-radius:12px;background:rgba(3,8,16,.9);box-shadow:inset 0 0 0 1px #2c3a58,0 20px 60px -20px #000;color:#edf1fb;font:600 34px/1.3 "IBM Plex Sans Condensed",sans-serif;text-align:center;transition:opacity .4s'
      document.body.append(el)
    }
    el.textContent = t
    el.style.opacity = t ? '1' : '0'
  }, text)
  if (ms) await page.waitForTimeout(ms)
}
if (demo) {
  // 0:00-0:20 the pain
  await page.setContent(CARD([['big', 'Every agent finished.', 0.3], ['big', "The build didn't.", 1.6]]))
  await page.waitForTimeout(6500)
  await page.setContent(CARD([
    ['small', 'Three AI agents. One codebase.', 0.2],
    ['small', 'One renamed a function the others still call.', 1.8],
    ['small', 'One "fixed" a failing test by rewriting the test.', 3.6],
    ['small', 'Nobody can tell which change broke the build.', 5.4],
    ['big', 'So teams stop trusting agents in parallel.', 7.6],
  ]))
  await page.waitForTimeout(12500)
  // 0:20-0:40 the idea and the Control Tower
  await page.goto(`${base}/?still`)
  await page.waitForTimeout(1200)
  await caption("Signalbox: railway interlocking for IBM Bob. Here is Bob's real run: 72 legacy calls down to 0.", 6500)
  await page.evaluate(() => document.getElementById('tower').scrollIntoView({ behavior: 'smooth', block: 'start' }))
  await caption('6 Bob subagents, up to 3 at once. One claim refused at a red signal. 6 of 6 blocks cleared, 0 faults.', 7000)
  await caption('Watch what happens when one agent goes rogue.', 1200)
  await page.click('#ask-input')
  await page.keyboard.type('simulate bad agent', { delay: 90 })
  await page.waitForTimeout(500)
  await caption('', 0)
  await page.keyboard.press('Enter')
  // 0:40-1:30 the proof, the finale, the close
  await page.waitForFunction(() => ['ok', 'fail'].includes(document.getElementById('proof')?.dataset.state), null, { timeout: 120e3, polling: 250 })
  await page.waitForTimeout(9000)
} else if (proof) {
  await page.goto(`${base}/?prove`)
  await page.waitForFunction(() => ['ok', 'fail'].includes(document.getElementById('proof')?.dataset.state), null, { timeout: 120e3, polling: 250 })
  await page.waitForTimeout(7500)
} else if (deck) {
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
