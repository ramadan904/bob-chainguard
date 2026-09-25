# Bob session evidence

Required by the hackathon: IBM Bob task session summary screenshots from **each team member**.

Name files `<member>-<what>.png`:

| `<what>` | Caption on the site and in the deck |
| --- | --- |
| `onboarding` | Onboarding: Bob reads the repo and the playbook |
| `expand` | Expand step: viem and wagmi added alongside |
| `dispatcher` | Dispatcher: Bob Agent mode starting subagents |
| `mcp` | Bob calling the Signalbox MCP tools |
| a block id, e.g. `w1-lib-1` | Bob subagent working block w1-lib-1 |
| `review` | Code review of the whole migration |
| `cleanup` | Cleanup: ethers and web3 removed |

`npm run atlas` (and `npm run finalize`) publish them as the **Bob at work** gallery on the panel
and a deck slide, and `finalize` cites them in `docs/submission/final/IBM_BOB_USAGE.md`.

Before committing, check that no screenshot shows a `.env` value, an IBM Cloud API key, an RPC key or a wallet seed.
