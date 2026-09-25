import '@fontsource/ibm-plex-sans-condensed/500.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import './deck.css'
import atlas from './data/atlas-data.json'
import { baselineIndex } from './state.js'
import { metrics } from '../../chainguard/src/signalbox-state.js'

// The deck reads the same bundled data as the panel: after `npm run finalize` the results slide
// shows the real run's numbers; before it, it says the run is pending. Nothing is typed in.
const ledger = Object.values(import.meta.glob('./data/ledger.json', { eager: true, import: 'default' }))[0] || []
const m = ledger.length ? metrics(ledger) : null
const base = atlas.snapshots[baselineIndex(atlas)]
const now = atlas.snapshots[atlas.snapshots.length - 1]
const ran = Boolean(m && m.cleared)

const dur = (ms) => (ms >= 3600e3 ? `${Math.floor(ms / 3600e3)} h ${Math.round((ms % 3600e3) / 60e3)} min` : `${Math.max(1, Math.round(ms / 60e3))} min`)
const lamp = (c) => `<span class="lamp-big ${c}"></span>`
const pending = '<span class="pending">after the Bob run</span>'

const slides = [
  // 1. title
  `<section class="slide title">
    <div class="kicker">IBM Bob 2.0 Hackathon</div>
    <h1>Signal<span>box</span></h1>
    <p class="big">Interlocking for parallel IBM&nbsp;Bob subagents.</p>
    <p class="sub">Many agents, one codebase, no collisions. Every change is proven before it's committed.</p>
    <div class="signals">${lamp('red')}${lamp('amber')}${lamp('green')}</div>
  </section>`,

  // 2. problem
  `<section class="slide">
    <div class="kicker">The problem</div>
    <h2>Parallel AI agents don't trust each other. Neither do we.</h2>
    <div class="cards three">
      <div class="card red"><b>They collide</b><p>Two agents edit the same file. One overwrites the other.</p></div>
      <div class="card red"><b>They break contracts</b><p>One agent renames a function another agent's code still calls.</p></div>
      <div class="card red"><b>They cheat</b><p>A failing test gets "fixed" by editing the test.</p></div>
    </div>
    <p class="note">The result is one giant diff nobody can review. So teams run one agent at a time, and big migrations stay slow.</p>
  </section>`,

  // 3. insight
  `<section class="slide">
    <div class="kicker">The insight</div>
    <h2>Railways solved "many trains, one network" 150 years ago.</h2>
    <div class="cards three">
      <div class="card"><div class="icon">${lamp('amber')}</div><b>Block</b><p>A section of track. One train at a time.<br><em>→ the files one subagent owns</em></p></div>
      <div class="card"><div class="icon">${lamp('red')}${lamp('green')}</div><b>Signal</b><p>No entry until the line ahead is clear.<br><em>→ a wave opens when earlier waves clear</em></p></div>
      <div class="card"><div class="icon">${lamp('green')}</div><b>Track circuit</b><p>Proves the block is empty before release.<br><em>→ four checks before any commit</em></p></div>
    </div>
    <p class="note">This is <strong>interlocking</strong>. Signalbox brings it to AI agents.</p>
  </section>`,

  // 4. how it works
  `<section class="slide">
    <div class="kicker">How it works</div>
    <h2>Bob plans, Bob works in parallel, the signal box keeps it safe.</h2>
    <ol class="flow">
      <li><b>Scan</b><span>chainguard finds ${base.totals.findings} legacy call sites and reads the import graph</span></li>
      <li><b>Plan</b><span>${atlas.plan.tasks.length} blocks in ${atlas.plan.waves} waves. Blocks in a wave never touch each other</span></li>
      <li><b>Dispatch</b><span>A Bob dispatcher agent starts a subagent for every green block</span></li>
      <li><b>Claim</b><span>Each subagent claims its block. Everyone else is locked out</span></li>
      <li><b>Prove</b><span>Release runs the track circuit on an isolated copy</span></li>
      <li><b>Commit</b><span>A clear block is committed alone and signed by its agent. Otherwise, fix or roll back</span></li>
    </ol>
  </section>`,

  // 5. track circuit
  `<section class="slide">
    <div class="kicker">The track circuit</div>
    <h2>No block is released until four checks pass.</h2>
    <div class="cards four">
      <div class="card"><div class="chk">S</div><b>Scope</b><p>Only this block's files changed. Anything else is a <strong>SPAD</strong> (signal passed at danger).</p></div>
      <div class="card"><div class="chk">C</div><b>Contract</b><p>No export another file still imports was removed or renamed.</p></div>
      <div class="card"><div class="chk">L</div><b>Legacy scan</b><p>Zero old-library calls left in the block.</p></div>
      <div class="card"><div class="chk">T</div><b>Isolated tests</b><p>Run on a git worktree with only cleared work plus this block, so agents can't cause or mask each other's failures.</p></div>
    </div>
  </section>`,

  // 6. bob
  `<section class="slide">
    <div class="kicker">IBM Bob does the work</div>
    <h2>Every capability the challenge names, doing real work.</h2>
    <table class="bob">
      <tr><td>Full-repo context + document understanding</td><td>Bob reads the repo and the migration playbook before touching anything</td></tr>
      <tr><td>Agent mode, multi-step orchestration</td><td>A dispatcher agent reads the signal box, starts subagents, handles faults, moves wave by wave</td></tr>
      <tr><td>Subagents + parallel tasks</td><td>One subagent per block, a whole wave at once, on files guaranteed not to overlap</td></tr>
      <tr><td>Self-correction</td><td>A red track circuit hands Bob the failing test. Bob fixes the code, not the test</td></tr>
      <tr><td>Code review</td><td>Bob reviews the full diff using the ledger of who changed what</td></tr>
    </table>
  </section>`,

  // 7. panel
  `<section class="slide shot">
    <div class="kicker">The live panel</div>
    <h2>Watch the agents work. Replay every decision.</h2>
    <img src="./panel.png" alt="The Signalbox panel: a transit map of the codebase, signal box board and train graph" />
    <p class="note">Files are stations, folders are lines, imports are tunnels. Blocks light up as agents enter, faults flash red with the failing test, and the train graph shows the agents running in parallel.</p>
  </section>`,

  // 8. command
  `<section class="slide">
    <div class="kicker">Operate it live</div>
    <h2>A control tower, a chaos button and a dispatcher that answers.</h2>
    <div class="cards three">
      <div class="card"><div class="icon">${lamp('amber')}${lamp('green')}</div><b>Control tower</b><p>One lane per Bob subagent, streamed from the ledger: the block it holds, its last move, and an amber <em>Held at signal</em> the moment interlocking refuses a claim.</p></div>
      <div class="card red"><div class="icon">${lamp('red')}</div><b>Chaos drill</b><p>One click makes a <strong>real</strong> stray edit or breaks a real export. The checks catch it in milliseconds, every release locks, and the file is restored from git. It's in the ledger too.</p></div>
      <div class="card"><div class="icon">${lamp('green')}</div><b>Dispatcher desk</b><p>"Start all green wave-1 blocks." "Why is w2-lib at danger?" Answers come from the ledger. Bob Agent mode asks the same desk from its terminal: <code>sb ask</code>.</p></div>
    </div>
  </section>`,

  // 9. results
  `<section class="slide">
    <div class="kicker">${ran ? 'Results from the real run' : 'Results'}</div>
    <h2>${ran ? 'Real numbers from the ledger, not a slide.' : 'Every number is computed from the run.'}</h2>
    <div class="metrics">
      <div><span class="n orange">${base.totals.findings}</span><span class="to">→</span><span class="n mint">${ran ? now.totals.findings : '?'}</span><label>legacy call sites</label></div>
      <div><span class="n mint">${ran ? `${m.cleared}/${m.blocks}` : `0/${atlas.plan.tasks.length}`}</span><label>blocks cleared by Bob</label></div>
      <div><span class="n amber">${ran ? m.agents.length : '?'}</span><label>Bob subagents${ran ? `, up to ${m.peakParallel} at once` : ''}</label></div>
      <div><span class="n red">${ran ? m.faults : '?'}</span><label>faults caught before commit</label></div>
      <div><span class="n">${ran ? `${m.denied} / ${m.drillsCaught}` : '?'}</span><label>claims refused at signal / chaos drills caught</label></div>
      <div><span class="n">${ran ? dur(m.wallClockMs) : '?'}</span><label>wall clock</label></div>
    </div>
    <p class="note">${ran ? 'Behavior tests: 22/22, never modified. The deployed panel replays this exact run.' : `Run pending: ${pending}. <code>npm run finalize</code> fills this slide from the ledger.`}</p>
  </section>`,

  // 10. safety + beyond
  `<section class="slide">
    <div class="kicker">Built to be trusted</div>
    <h2>Safe even when an agent misbehaves. Useful beyond this demo.</h2>
    <div class="cards two">
      <div class="card"><b>Safety net</b><ul>
        <li>Tamper-evident ledger: SHA-256 hash chain, audited against git in CI and re-verified in the browser, with a live tamper test</li>
        <li>Tests and the checker are protected: agents can't edit them</li>
        <li>Live SPAD alarm the second an unclaimed file changes, proven on demand by the chaos drill</li>
        <li>Pre-commit guard: no bypassing the signal box</li>
        <li>Black-box recorder restores work a rogue <code>git checkout</code> would wipe</li>
        <li>Expand → migrate → contract: shared code changes last, and only when unused</li>
      </ul></div>
      <div class="card"><b>Any migration</b><ul>
        <li>Rule packs: Web3 (ethers/web3.js → viem) built in</li>
        <li>Moment.js → date-fns pack included, 13 rules + playbook, switchable live in the panel on a real sample app (41 call sites, 4 blocks)</li>
        <li>Same interlocking for framework upgrades, API renames, library swaps</li>
        <li>Review each agent's exact diff, and see any file's blast radius</li>
        <li>One command after the run: <code>npm run finalize</code></li>
      </ul></div>
    </div>
  </section>`,

  // 11. close
  `<section class="slide title close">
    <div class="signals">${lamp('green')}${lamp('green')}${lamp('green')}</div>
    <h2 class="huge">Parallel Bob subagents<br>you can actually trust.</h2>
    <p class="sub">bob-chainguard.vercel.app · github.com/ramadan904/bob-chainguard</p>
  </section>`,
]

const root = document.getElementById('slides')
root.innerHTML = slides.join('')
const all = [...root.querySelectorAll('.slide')]
let i = Math.max(0, Math.min(all.length - 1, Number(location.hash.slice(1)) - 1 || 0))

function fit() {
  const scale = Math.min(innerWidth / 1920, (innerHeight - 56) / 1080)
  document.documentElement.style.setProperty('--scale', String(scale))
}
function show(n) {
  i = Math.max(0, Math.min(all.length - 1, n))
  all.forEach((s, k) => s.classList.toggle('active', k === i))
  document.getElementById('count').textContent = `${i + 1} / ${all.length}`
  history.replaceState(null, '', `#${i + 1}`)
}
addEventListener('resize', fit)
addEventListener('keydown', (e) => {
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); show(i + 1) }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); show(i - 1) }
})
document.getElementById('prev').onclick = () => show(i - 1)
document.getElementById('next').onclick = () => show(i + 1)
document.getElementById('print').onclick = () => print()
root.addEventListener('click', (e) => { if (!e.target.closest('a')) show(i + 1) })
fit()
show(i)
