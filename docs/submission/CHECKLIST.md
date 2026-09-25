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
- [ ] Demo platform + **Application URL**: deploy **Chainguard Atlas** as a static site.
  First run `npm run atlas` locally and commit `atlas/src/data/atlas-data.json`, because hosts clone shallow and can't rebuild the history.
  Then use Vercel or Netlify with root `atlas`, build `npm run build`, output `dist`.
- [ ] Optional second URL: the migrated `legacy-dapp` (root `legacy-dapp`, build `npm run build`, output `dist`, env `VITE_RPC_URL`, `VITE_ERC20_ADDRESS`)

## Media
- [ ] Cover image (1920x1080 recommended): a screenshot of the finished Atlas map (dark theme) with "72 → 0" set large
- [ ] Video of 3:00 or less (docs/submission/DEMO_SCRIPT.md), uploaded (YouTube unlisted works)
- [ ] Slides: problem, solution architecture (scan, plan, Bob waves, tests, guard), Bob usage, results table, generalization, team

## Written statements (500 words max each)
- [ ] Problem & Solution: docs/submission/PROBLEM_SOLUTION.md with [brackets] replaced (recount words after filling)
- [ ] IBM Bob Usage: docs/submission/IBM_BOB_USAGE.md with [brackets] replaced

## After submitting
- [ ] Fill in the post-hackathon feedback form (needed for the $100 participant reward)
