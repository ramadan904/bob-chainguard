# proof-yard: the safety-proof fixture

A deliberately tiny codebase for `signalbox prove` (the panel's **Prove safety** button). Three
independent modules, each one block, plus an entry file that imports all three. The "legacy" to
remove is `var` (rule pack `pack.json`, rule VAR001), so a drill agent's correct change is trivial
and the proof is about the interlocking, not the migration.

The proof copies this folder into a throwaway git repository, opens a real signal box on it and
runs three **scripted drill agents** (drill-1, drill-2, drill-3) as three separate processes at the
same time. They are not IBM Bob: Bob's real parallel run is on `legacy-dapp/`. Two drill agents
make the correct change; drill-3 edits `src/index.js` (outside its block) and renames an export
`index.js` still imports. The track circuit catches both, drill-3 rolls back, and the other two
release and commit. Nothing here touches this repository or its ledger.

Mapping for VAR001: `var` becomes `const` (or `let` when reassigned).
