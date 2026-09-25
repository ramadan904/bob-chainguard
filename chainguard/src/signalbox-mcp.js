// Signalbox as an MCP server (Model Context Protocol, stdio transport, JSON-RPC 2.0 one message
// per line). Bob's agents can then claim, release and ask as native tool calls instead of shell
// commands. Every call goes through the same operations as the CLI, so the interlocking, the
// ledger and the checks are identical. Zero dependencies.

import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { claim, release, rollback, extend, loadState, readLedger, checkpoint, packOf, SignalboxError } from './signalbox.js'
import { describe, summary, blockFiles } from './signalbox-state.js'
import { ask } from './dispatch.js'
import { scanDir } from './scan.js'

const VERSION = '1.0.0'

const str = (description) => ({ type: 'string', description })
const TOOLS = [
  {
    name: 'signalbox_status',
    description: 'Every block with its signal (DANGER, CLEAR, OCCUPIED, FAULT, CLEARED), wave and agent. Call this first.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'signalbox_next',
    description: 'Blocks a dispatcher may start now (green and free), plus occupied, faulted and waiting blocks.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'signalbox_ask',
    description: 'Ask the signal box in plain words: "start all green wave-1 blocks", "riskiest remaining block", "why is w2-lib at danger?", "blast radius of lib/units.js", "who is working?". Answers come from the ledger.',
    inputSchema: { type: 'object', properties: { question: str('The question') }, required: ['question'] },
  },
  {
    name: 'signalbox_prompt',
    description: "A block's subagent prompt, with the agent name filled in. Give it to the subagent as its task.",
    inputSchema: { type: 'object', properties: { block: str('Block id, e.g. w1-lib-1'), agent: str('Agent name, e.g. bob-1') }, required: ['block', 'agent'] },
  },
  {
    name: 'signalbox_claim',
    description: 'Enter a block. Refused (and recorded) while its signal is at danger or its files are held by another agent. Edit only the files it returns.',
    inputSchema: { type: 'object', properties: { block: str('Block id'), agent: str('Your agent name') }, required: ['block', 'agent'] },
  },
  {
    name: 'signalbox_extend',
    description: 'Add files to your block when the change genuinely needs them. Refused if another agent holds them or they are protected.',
    inputSchema: { type: 'object', properties: { block: str('Block id'), agent: str('Your agent name'), files: { type: 'array', items: { type: 'string' }, description: 'Repo-relative paths' } }, required: ['block', 'agent', 'files'] },
  },
  {
    name: 'signalbox_release',
    description: 'Run the track circuit (scope, exported contract, legacy scan, behavior tests on an isolated worktree). If all pass, the block is committed alone. If not, returns every failure: fix the code (never the tests) and release again.',
    inputSchema: { type: 'object', properties: { block: str('Block id'), agent: str('Your agent name') }, required: ['block', 'agent'] },
  },
  {
    name: 'signalbox_rollback',
    description: "Restore your block's files and free it. The dispatcher can free a stuck agent's block with operator: true.",
    inputSchema: { type: 'object', properties: { block: str('Block id'), agent: str('Your agent name'), operator: { type: 'boolean' } }, required: ['block', 'agent'] },
  },
  {
    name: 'signalbox_log',
    description: 'The latest ledger events, one line each (the train describer).',
    inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'How many events (default 30)' } } },
  },
]

function statusText(root) {
  const state = loadState(root)
  const s = summary(state)
  const rows = Object.values(state.tasks).sort((a, b) => a.wave - b.wave || a.id.localeCompare(b.id))
    .map((t) => `W${t.wave} ${t.id} ${t.state.toUpperCase()}${t.agent && !t.commit ? ` ${t.agent}` : ''}${t.commit ? ` ${t.commit.slice(0, 7)}` : ''} [${blockFiles(t).join(', ')}]`)
  return [`${s.cleared}/${s.total} blocks cleared, agents: ${s.agents.join(', ') || 'none'}`, ...rows].join('\n')
}

function failures(v) {
  const c = v.checks
  const out = []
  if (!c.scope.ok) out.push(`scope: edits outside your block or to protected files: ${c.scope.outside.join(', ')}. Revert them.`)
  if (!c.contract.ok) out.push(`contract: removed exports still imported: ${c.contract.removed.map((r) => `${r.file}#${r.name} (used by ${r.usedBy.join(', ')})`).join('; ')}. Keep them.`)
  if (!c.scan.ok) out.push(`legacy scan: ${c.scan.remaining} call sites left: ${Object.entries(c.scan.findings || {}).flatMap(([f, l]) => l.map(([id, line, snip]) => `${f}:${line} ${id} ${snip}`)).join(' | ')}`)
  if (!c.tests.ok) out.push(`tests: ${c.tests.summary || `exit ${c.tests.exitCode}`}\n${(c.tests.failures?.length ? c.tests.failures : (c.tests.tail || []).slice(-15)).join('\n')}`)
  return out
}

export function callTool(root, name, args = {}) {
  switch (name) {
    case 'signalbox_status':
      checkpoint(root)
      return statusText(root)
    case 'signalbox_next': {
      checkpoint(root)
      const list = Object.values(loadState(root).tasks)
      return JSON.stringify({
        done: list.every((t) => t.commit),
        ready: list.filter((t) => t.state === 'clear').map((t) => ({ block: t.id, wave: t.wave, files: blockFiles(t) })),
        occupied: list.filter((t) => t.state === 'occupied').map((t) => ({ block: t.id, agent: t.agent })),
        fault: list.filter((t) => t.state === 'fault').map((t) => ({ block: t.id, agent: t.agent, attempts: t.attempts })),
        waiting: list.filter((t) => t.state === 'danger').map((t) => t.id),
      }, null, 2)
    }
    case 'signalbox_ask': {
      const state = loadState(root)
      const report = scanDir(join(root, state.scanDir), packOf(root, state).rules)
      const a = ask(args.question, { state, files: Object.entries(report.imports).map(([id, imports]) => ({ id, imports })) })
      return [a.text, ...(a.lines || []).map((l) => `  ${l}`), ...(a.prompt ? ['', a.prompt] : [])].join('\n')
    }
    case 'signalbox_prompt': {
      const t = loadState(root).tasks[args.block]
      if (!t) throw new SignalboxError(`unknown block ${args.block}`)
      return t.prompt.replaceAll('<your-agent-name>', args.agent)
    }
    case 'signalbox_claim': {
      claim(root, args.block, args.agent)
      const t = loadState(root).tasks[args.block]
      return `GREEN ${args.block}: ${args.agent} may enter. Edit only these files:\n${blockFiles(t).join('\n')}`
    }
    case 'signalbox_extend':
      extend(root, args.block, args.agent, args.files || [])
      return `${args.block} now also holds ${(args.files || []).join(', ')}`
    case 'signalbox_release': {
      const r = release(root, args.block, args.agent)
      if (!r.ok) throw new SignalboxError(`FAULT ${args.block}. Nothing was committed.\n${failures(r.verify).join('\n')}`)
      return r.clear ? `CLEARED ${args.block}: committed as ${r.clear.commit.slice(0, 7)}` : `CLEAR ${args.block}`
    }
    case 'signalbox_rollback': {
      const e = rollback(root, args.block, args.agent, { operator: Boolean(args.operator) })
      return `ROLLED BACK ${args.block}: restored ${e.files.join(', ') || 'nothing'}`
    }
    case 'signalbox_log':
      return readLedger(root).slice(-(args.limit || 30)).map((e) => `${e.at.slice(11, 19)} ${describe(e)}`).join('\n')
    default:
      throw new SignalboxError(`unknown tool ${name}`)
  }
}

// One JSON-RPC message in, zero or one out.
export function handle(root, msg) {
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result })
  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: msg.params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'signalbox', version: VERSION },
        instructions: 'Interlocking for parallel agents. Claim a block before editing, edit only its files, release to run the checks. Never edit tests or run git commands.',
      })
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call':
      try {
        return reply({ content: [{ type: 'text', text: callTool(root, msg.params?.name, msg.params?.arguments || {}) }] })
      } catch (err) {
        if (!(err instanceof SignalboxError)) throw err
        return reply({ content: [{ type: 'text', text: err.message }], isError: true })
      }
    default:
      if (msg.id === undefined) return null // notification
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } }
  }
}

export function serveMcp(root, { input = process.stdin, output = process.stdout } = {}) {
  // stdout carries protocol messages only; anything else a library prints goes to stderr.
  console.log = (...a) => console.error(...a)
  const rl = createInterface({ input })
  rl.on('line', (line) => {
    if (!line.trim()) return
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })}\n`)
      return
    }
    let out
    try {
      out = handle(root, msg)
    } catch (err) {
      out = { jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32603, message: err.message } }
    }
    if (out) output.write(`${JSON.stringify(out)}\n`)
  })
  return new Promise((resolve) => rl.on('close', resolve))
}
