# Signalbox as MCP tools for Bob

`signalbox mcp` is a Model Context Protocol server (stdio, zero dependencies). With it, Bob's
dispatcher and subagents call the signal box as **native tools** instead of shell commands. The
interlocking is the same: every tool call goes through the same operations as the CLI, and every
move lands in the same hash-chained ledger.

| Tool | What it does |
| --- | --- |
| `signalbox_status` | Every block: signal, wave, agent, files |
| `signalbox_next` | Blocks a dispatcher may start now, plus occupied / faulted / waiting |
| `signalbox_ask` | Plain-language desk: "start all green wave-1 blocks", "why is w2-lib at danger?" |
| `signalbox_prompt` | A block's subagent prompt, with the agent name filled in |
| `signalbox_claim` | Enter a block (refused and recorded while its signal is at danger) |
| `signalbox_extend` | Add files to your block |
| `signalbox_release` | Track circuit: scope, contract, legacy scan, isolated tests; commit if clear, else every failure |
| `signalbox_rollback` | Restore your block and free it (`operator: true` for the dispatcher) |
| `signalbox_log` | Latest ledger events |

## Add it to Bob

In Bob's MCP server settings, add a server with this definition (use the absolute path of your
clone; check Bob's documentation for where its MCP configuration file lives):

```json
{
  "mcpServers": {
    "signalbox": {
      "command": "node",
      "args": ["chainguard/bin/signalbox.js", "mcp", "--root", "/absolute/path/to/bob-chainguard"]
    }
  }
}
```

If Bob asks for a working directory, use the repo root. Test it outside Bob first:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node chainguard/bin/signalbox.js mcp
```

## Dispatcher prompt with tools

Use the dispatcher prompt from `BOB_RUNBOOK.md` and replace each `npm run -s sb -- <cmd>` with the
matching tool: `signalbox_next`, `signalbox_prompt`, `signalbox_ask`, and for subagents
`signalbox_claim` → edit → `signalbox_release`. Faults come back as tool errors listing every
failing check, so Bob can fix and release again without parsing terminal output.

The CLI keeps working side by side: tools and shell commands write to the same ledger, and the
live panel shows both.
