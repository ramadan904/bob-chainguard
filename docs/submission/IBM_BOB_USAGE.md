# IBM Bob Usage Statement

<!-- Limit: 500 words. Fill the [bracketed] parts from reports/timings.md and bob_sessions/ after the run. -->

IBM Bob 2.0 did the migration itself: every change to `legacy-dapp/src` between tag
`before-bob` and the final commit was made by Bob. We built the harness around it (the
chainguard scanner, the behavior tests and the playbook) so Bob's work could be planned,
parallelized and verified.

## Where Bob was used

| Workflow step | Bob capability | Evidence |
| --- | --- | --- |
| **Onboarding.** Explain how wallet, ERC-20, signing and events flow through lib, hooks and components, and flag migration risks | Full-repo context, document understanding (README, playbook, baseline report) | `bob_sessions/[member]-onboarding.png` |
| **Plan review.** Check the chainguard wave plan against the real import graph | Plan / Agent mode | `bob_sessions/[member]-plan.png` |
| **Setup.** Add viem/wagmi and wire WagmiProvider and QueryClientProvider | Agent mode (edit, install, build) | commit `[sha]` |
| **Wave 1.** `w1-lib-1`, `w1-lib-2` | **Parallel subagents** | commit `[sha]` |
| **Wave 2.** `w2-lib`, `w2-hooks` | **Parallel subagents** | commit `[sha]` |
| **Wave 3.** `w3-hooks`, `w3-components` | **Parallel subagents** | commit `[sha]` |
| **Test-failure loop.** For example, viem `parseUnits` rounding vs ethers throwing | Agent mode runs the tests and fixes the implementation | `bob_sessions/[member]-[task].png` |
| **Cleanup.** Remove ethers and web3, rebuild | Agent mode | commit `[sha]` |
| **Code review.** Review the whole `before-bob..HEAD` diff for behavior changes the tests miss | Full-repo reasoning | `bob_sessions/[member]-review.png` |

## How we used Bob well

- **Documents as instructions.** `docs/MIGRATION_PLAYBOOK.md` holds the mapping table, the hard
  rules (stable signatures, no test edits) and a "known traps" table. Every task prompt points
  Bob to it, so all subagents apply the same conventions.
- **Generated prompts, not ad hoc chat.** `chainguard plan` emits one prompt per task, each with
  the exact files, the rule ids found there and a machine-checkable definition of done. Bob's
  scope stays tight and the tasks can run in parallel safely.
- **Objective acceptance.** Each task finishes only when `npm run scan` shows zero findings for
  its files and `npm test` passes, so Bob's output is checked mechanically rather than by eye.

## Results

- [72 -> 0] legacy call sites, [10 -> 0] legacy files
- [22/22] behavior tests passing, none modified
- [N] tasks across [3] waves, total Bob time [X h Y min], [Z] Bobcoins
- `git diff --stat before-bob..HEAD -- legacy-dapp/src`:

```text
[paste here]
```

## watsonx

Not used. [Or describe it if you add it, e.g. watsonx.ai summarizing chainguard reports for a PR comment.]
