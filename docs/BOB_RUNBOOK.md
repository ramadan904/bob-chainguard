# Hackathon runbook: running the migration with IBM Bob

This is the step-by-step plan for the 48-hour window. The steps are Bob's work. Our job is to
set them up, time them, and capture the evidence judges ask for.

> Bob's UI changes between releases. Mode and button names below follow the challenge wording
> (Agent mode, parallel tasks, subagents, document understanding). Check the exact names
> against the official Bob 2.0 Hackathon Guide linked from the event page.

## 0. Setup (≈30 min)

1. Open this repo in the Bob IDE and sign in with the hackathon account.
2. `cp .env.example .env`. The defaults work; never paste a key into a Bob prompt.
3. `npm ci --prefix legacy-dapp && npm test && npm run scan:baseline && npm run plan`
4. Commit if anything changed. **Tag the before state:** `git tag before-bob && git push origin before-bob`.
5. Start a stopwatch log in `reports/timings.md` (task id, start, end, Bobcoins used).

## 1. Onboarding: Bob explains the legacy code (document understanding)

Prompt:

```text
Read @README.md, @docs/MIGRATION_PLAYBOOK.md and @reports/baseline.md, then walk the
legacy-dapp/src folder. Explain to a new team member how wallet connection, ERC-20 reads,
transfers, signing and the activity feed flow through lib -> hooks -> components, and which
parts depend on ethers v5 versus web3.js. List risks you see for a viem/wagmi migration.
```

Screenshot the answer. It becomes the "Bob understands the whole repo" part of the video.

## 2. Plan review (Plan / Agent mode)

Prompt:

```text
Review @reports/bob-task-plan.md, which chainguard generated from the import graph.
Check that the waves respect dependencies and that no two tasks in a wave edit the same file.
Propose changes to the plan if needed, but don't edit any code yet.
```

## 3. Setup task (before wave 1)

```text
In legacy-dapp: add viem@2, wagmi@3 and @tanstack/react-query@5 as dependencies (keep ethers
and web3 for now). Create src/wagmi.js and wrap <App /> in src/main.jsx exactly as described in
@docs/MIGRATION_PLAYBOOK.md "React hooks". Run npm run build --prefix legacy-dapp.
```

## 4. Waves: parallel subagents

For each wave in `reports/bob-task-plan.md`:

1. Start one Bob subagent / parallel task **per task block**, pasting its prompt as written.
2. When every task in the wave finishes, run `npm run scan && npm test` yourself (or ask Bob to).
3. Commit the wave: `git commit -am "Bob wave N: <task ids>"`. One commit per wave keeps the diff
   story readable for judges.
4. Log times and Bobcoins in `reports/timings.md`.

If a test fails, don't fix it by hand. Paste the failure into the same subagent:
"Test X fails with: ... Fix the implementation per the playbook traps table." That loop is part of the demo.

## 5. Cleanup and guard

```text
chainguard reports 0 findings. Remove ethers and web3 from legacy-dapp/package.json, reinstall,
and make npm run build and npm test pass. Then run npm run report and summarize reports/after.md.
```

Then switch CI to blocking: in `.github/workflows/ci.yml` change the scan step to `npm run guard`.
From then on any new ethers/web3.js code fails the PR. That's the "guard" in chainguard.

## 6. Code review by Bob

```text
Review the full diff between tag before-bob and HEAD as a senior reviewer. Look for behavior
changes the tests would not catch (event ordering, bigint/number mixing in the UI, error
messages shown to users, receipt status handling). List findings with file:line.
```

Fix what it finds in a last wave. This covers the "code review" workflow too.

## 7. Evidence for the submission

- [ ] Export the Bob session summary for **every** task and every team member into `bob_sessions/`
      (screenshots as PNG, plus any exported reports). The template's `.gitignore` keeps this folder on purpose.
- [ ] `reports/baseline.md`, `reports/after.md`, `reports/timings.md` committed.
- [ ] `git diff --stat before-bob..HEAD -- legacy-dapp/src` pasted into `docs/submission/IBM_BOB_USAGE.md`.
- [ ] Fill the numbers in `docs/submission/*.md` from the real run.
