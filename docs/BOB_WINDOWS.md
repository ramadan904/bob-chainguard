# The real IBM Bob run on Windows 11, step by step

Everything you need, in order. Each step says what to do and what you should see. The prompts are
also in `docs/BOB_RUNBOOK.md`; the helper commands print them for you.

Use **Command Prompt** (Windows key, type `cmd`, Enter), not PowerShell: PowerShell often blocks
`npm` with a "running scripts is disabled" error. Inside Bob, open its terminal with **Terminal → New
Terminal**, then pick **Command Prompt** from the ▾ next to the + if it opened PowerShell.

---

## Step 1. Install (once)

| Tool | Where | Check in cmd |
| --- | --- | --- |
| Node.js 22 LTS | https://nodejs.org (the LTS button, default options) | `node -v` shows v22 (v20+ works) |
| Git | https://git-scm.com/download/win (default options) | `git --version` shows a version |
| IBM Bob | https://bob.ibm.com (sign in with your IBM account) | Bob opens and you are signed in |

After installing Node or Git, **close cmd and open a new one**, or the commands are "not recognized".

## Step 2. Get the project and prepare it

```
cd %USERPROFILE%\Desktop
git clone https://github.com/ramadan904/bob-chainguard.git
cd bob-chainguard
git checkout claude/dazzling-ptolemy-c288r3
npm run bob:prep
```

`bob:prep` installs everything (2 to 5 minutes), runs every test suite, tags the starting point
`before-bob` and prints the first two Bob prompts. You want `ok` on every line and no `FAIL`.

## Step 3. Open the project in Bob

**File → Open Folder → Desktop → bob-chainguard → Select Folder.** If Bob asks whether you trust
the authors, choose **Yes**. In Bob's chat, switch to **Agent mode**.

## Step 4. Session 1: Bob reads the codebase (your first real evidence)

Paste the **first** prompt `bob:prep` printed ("Read @README.md, @docs/MIGRATION_PLAYBOOK.md…").
When Bob finishes, screenshot its answer and the task summary (with the Bobcoin cost) and save it as
`bob_sessions\yourname-onboarding.png`.

## Step 5. Session 2: Bob adds viem (the expand step)

Paste the **second** prompt ("Do only the expand step…"). Bob installs viem and wagmi, creates
`src/lib/viem.js`, runs the tests and build, and commits `Expand: …`. Screenshot the summary:
`bob_sessions\yourname-expand.png`.

## Step 6. Open the signal box and the live panel

In cmd (in the bob-chainguard folder):

```
npm run bob:open
```

It checks the expand step, opens the signal box (6 blocks in 2 waves), installs the commit guard,
runs `doctor`, prints the **dispatcher prompt**, and starts the live panel. Open
**http://localhost:4700** in your browser and keep this cmd window open.

## Step 7. Session 3: the dispatcher runs Bob's agents in parallel (the demo)

Start screen recording now (Windows: **Win + Alt + R** with Xbox Game Bar, or OBS) so the panel and
Bob are both visible.

Paste the **dispatcher prompt** from Step 6 into Bob (Agent mode, subagents / parallel tasks on). Bob
starts one subagent per green block; you will see BOB-1, BOB-2, BOB-3 working at once in the panel,
claims refused at red signals, faults caught before commit and blocks clearing one commit at a time.
Let it run until the panel shows every block cleared.

Screenshot the dispatcher summary and each subagent summary:
`bob_sessions\yourname-dispatcher.png`, `bob_sessions\bob-w1-lib-1.png`, and so on.

If a take goes badly: `npm run bob:retake -- --yes` goes back to the expand commit with a fresh
signal box (the attempt is kept on a practice branch). Then repeat Step 7.

## Step 8. Sessions 4 and 5: cleanup and review

Paste these into Bob, one at a time, and screenshot each summary:

```
Every block is CLEARED. Remove ethers and web3 from legacy-dapp/package.json, reinstall, make
npm run build and npm test pass, run npm run report, and commit "Remove ethers and web3".
```

```
Review the diff between tag before-bob and HEAD as a senior reviewer. Use `npm run -s sb -- log`
to see which agent changed which block and which faults were caught. Look for behavior changes the
tests would not catch (event ordering, bigint/number mixing in the UI, user-facing error messages,
receipt status handling). List findings with file:line.
```

## Step 9. Fill in the real numbers and publish

```
npm run finalize
git add -A
git commit -m "Real IBM Bob run: ledger, screenshots and statements"
git push origin claude/dazzling-ptolemy-c288r3
```

`finalize` runs the guard, tests and build, exports Bob's ledger to the panel and rewrites both
statements in `docs/submission/final/` with the real numbers from the run. On the first `git push`,
Windows opens a browser window to sign in to GitHub: sign in as ramadan904. Then merge the branch
on GitHub (Compare → Create pull request → Merge) so the live site shows Bob's run.

## If something goes wrong

| You see | Do this |
| --- | --- |
| `'node' is not recognized` / `'git' is not recognized` | Install it (Step 1), then open a **new** cmd |
| `running scripts is disabled on this system` | You are in PowerShell: use cmd instead |
| `bob:prep` shows `FAIL tests fail` | Run `npm test`, screenshot the end, ask for help |
| `bob:open` says "expand step not found" | Do Step 5 first (Bob must commit the expand step) |
| Port 4700 already in use | Close the other cmd window running the panel, or restart the PC |
| Bob cannot run commands | In Bob's settings, allow terminal commands for this workspace |

Never edit `legacy-dapp/src` yourself: the point is that Bob does the migration.
