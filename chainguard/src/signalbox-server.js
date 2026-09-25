// Live signal box: serves the built Atlas UI and streams what Bob's subagents are doing.
//   GET /api/snapshot   git history (Atlas data) + full ledger
//   GET /api/stream     server-sent events: `ledger` (new events), `live` (fresh scan + who owns
//                       each modified file), `head` (a block was committed; refetch the snapshot)
// Zero dependencies: node:http, fs.watch and the same scanner/reducer as the CLI.

import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, watch, openSync, readSync, closeSync, mkdirSync } from 'node:fs'
import { join, extname, normalize, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { gitSnapshots, buildAtlas } from './atlas.js'
import { scanDir } from './scan.js'
import { readLedger, ledgerPath, modifiedFiles, checkpoint, packOf } from './signalbox.js'
import { loadPack } from './pack.js'
import { reduce, ownerOf } from './signalbox-state.js'

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png' }

export async function serve(root, { port = 4700, dist = join(root, 'atlas', 'dist'), scanPath } = {}) {
  const ledger = ledgerPath(root)
  mkdirSync(dirname(ledger), { recursive: true })
  const scanRoot = () => scanPath || reduce(readLedger(root))?.scanDir || 'legacy-dapp/src'
  const clients = new Set()
  const send = (type, data) => {
    const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of clients) res.write(msg)
  }

  const packNow = () => {
    const state = reduce(readLedger(root))
    return state ? packOf(root, state) : loadPack(null)
  }
  const snapshot = () => {
    const pack = packNow()
    return { atlas: buildAtlas(gitSnapshots(join(root, scanRoot()), pack.rules), pack), ledger: readLedger(root), live: liveScan() }
  }

  function liveScan() {
    const dir = scanRoot()
    const report = scanDir(join(root, dir), packNow().rules)
    const findings = {}
    for (const f of report.findings) (findings[f.file] ||= []).push([f.ruleId, f.line, f.snippet])
    const state = reduce(readLedger(root))
    const modified = modifiedFiles(root).filter((f) => f.startsWith(`${dir}/`))
    const owners = Object.fromEntries(modified.map((f) => [f.slice(dir.length + 1), state ? ownerOf(state, f) : null]))
    return { at: new Date().toISOString(), findings, present: Object.keys(report.imports), modified: Object.keys(owners), owners, totals: report.totals }
  }

  // Ledger: stream appended lines by byte offset.
  let offset = existsSync(ledger) ? statSync(ledger).size : 0
  const pumpLedger = () => {
    if (!existsSync(ledger)) return
    const size = statSync(ledger).size
    if (size < offset) offset = 0 // re-initialised
    if (size === offset) return
    const fd = openSync(ledger, 'r')
    const buf = Buffer.alloc(size - offset)
    readSync(fd, buf, 0, buf.length, offset)
    closeSync(fd)
    const text = buf.toString('utf8')
    const end = text.lastIndexOf('\n') + 1
    offset += Buffer.byteLength(text.slice(0, end))
    for (const line of text.slice(0, end).split('\n').filter(Boolean)) {
      const e = JSON.parse(line)
      send('ledger', e)
      if (e.t === 'clear' || e.t === 'init') send('head', { commit: e.commit || e.base })
    }
    scheduleScan()
  }

  let scanTimer = null
  const scheduleScan = () => {
    clearTimeout(scanTimer)
    scanTimer = setTimeout(() => {
      try { checkpoint(root) } catch (err) { console.error('checkpoint failed:', err.message) }
      try { send('live', liveScan()) } catch (err) { console.error('scan failed:', err.message) }
    }, 250)
  }

  watch(dirname(ledger), () => pumpLedger())
  const srcDir = join(root, scanRoot())
  watch(srcDir, { recursive: true }, (_, file) => {
    if (file && !String(file).includes('node_modules')) scheduleScan()
  })
  setInterval(pumpLedger, 1000).unref() // belt and braces for filesystems without reliable events

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/api/snapshot') {
      try {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        res.end(JSON.stringify(snapshot()))
      } catch (err) {
        res.writeHead(500, { 'content-type': 'text/plain' })
        res.end(err.message)
      }
      return
    }
    if (url.pathname === '/api/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
      res.write(': signal box connected\n\n')
      clients.add(res)
      const ping = setInterval(() => res.write(': ping\n\n'), 15000)
      req.on('close', () => {
        clearInterval(ping)
        clients.delete(res)
      })
      return
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '') || 'index.html'
    const file = join(dist, rel)
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      if (!existsSync(join(dist, 'index.html'))) {
        res.writeHead(503, { 'content-type': 'text/plain' })
        res.end('Atlas UI is not built yet. Run: npm run build --prefix atlas')
        return
      }
      res.writeHead(200, { 'content-type': TYPES['.html'] })
      res.end(readFileSync(join(dist, 'index.html')))
      return
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(readFileSync(file))
  })

  await new Promise((resolve) => server.listen(port, resolve))
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  console.log(`signal box live at http://localhost:${port}  (repo ${head}, watching ${scanRoot()} and .signalbox/ledger.jsonl)`)
  return server
}
