# Submission checklist (deadline: Sun Sep 27 2026, 11:00 AM EDT / 15:00 UTC)

Aim to submit by **Sep 27, 09:00 EDT** to leave a buffer for upload problems.

## Basic info
- [ ] **Title:** bob-chainguard: Bob-driven, test-guarded Web3 frontend migration
- [ ] **Short description:** IBM Bob migrates a legacy web3.js + ethers v5 dApp to viem/wagmi in parallel waves planned by chainguard, verified by behavior tests and guarded in CI.
- [ ] **Long description:** adapt docs/submission/PROBLEM_SOLUTION.md
- [ ] **Tags:** IBM Bob, Agentic AI, Developer Tools, Code Migration, Web3, Ethereum, viem, wagmi, React

## Code & evidence
- [ ] Repo is **public** (GitHub, Settings, then Danger zone, then Change visibility)
- [ ] `git log -p | grep -iE "api[_-]?key|private[_-]?key|mnemonic"` shows only docs and placeholders
- [ ] `bob_sessions/` has session summary screenshots from **every** team member
- [ ] `reports/baseline.md`, `reports/after.md`, `reports/timings.md` filled in
- [ ] `npm run finalize` after the recorded run. It must end with "Warnings: None". It writes
  `reports/submission-numbers.md` with every number for the statements, and the replay bundle.
- [ ] Commit `.signalbox/ledger.jsonl reports/ atlas/src/data/ bob_sessions/`, push, merge to `main`.
- [ ] Demo platform + **Application URL**. Pick one:
  - **GitHub Pages:** Settings → Pages → Source "GitHub Actions". The `deploy panel` workflow
    publishes on every push to `main`. URL: `https://<user>.github.io/<repo>/`
  - **Netlify:** import the repo. `netlify.toml` already sets base `atlas`, build and publish.
  - **Vercel:** import the repo. `vercel.json` already sets install, build and output.
- [ ] Optional second URL: the migrated `legacy-dapp` (root `legacy-dapp`, build `npm run build`, output `dist`, env `VITE_RPC_URL`, `VITE_ERC20_ADDRESS`)

## Media
- [ ] Cover image (1920x1080 recommended): a screenshot of the finished Atlas map (dark theme) with "72 → 0" set large
- [ ] Video of 3:00 or less (docs/submission/DEMO_SCRIPT.md), uploaded (YouTube unlisted works)
- [ ] Slides: problem, solution architecture (scan, plan, Bob waves, tests, guard), Bob usage, results table, generalization, team

## Written statements (500 words max each)
- [ ] Problem & Solution: paste docs/submission/final/PROBLEM_SOLUTION.md (written by `npm run finalize`, word count printed)
- [ ] IBM Bob Usage: paste docs/submission/final/IBM_BOB_USAGE.md (no missing-value warnings)

## After submitting
- [ ] Fill in the post-hackathon feedback form (needed for the $100 participant reward)
