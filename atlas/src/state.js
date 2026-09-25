// Derived migration state for one snapshot. Pure functions.

export function baselineIndex(atlas) {
  const i = atlas.snapshots.findIndex((s) => s.totals.findings > 0)
  return i === -1 ? 0 : i
}

export function stationStatus(atlas, snapIndex, fileId) {
  const snap = atlas.snapshots[snapIndex]
  if (!snap.present.includes(fileId)) return { status: 'absent', count: 0, baseline: 0 }
  const count = snap.findings[fileId]?.length || 0
  const baseline = atlas.snapshots[baselineIndex(atlas)].findings[fileId]?.length || 0
  const status = count > 0 ? 'legacy' : baseline > 0 ? 'migrated' : 'clean'
  return { status, count, baseline }
}

// SCHEDULED: untouched since baseline. BOARDING: some of its call sites are gone. ARRIVED: none left.
export function taskStatus(atlas, snapIndex, task) {
  let now = 0
  let before = 0
  for (const f of task.files) {
    const s = stationStatus(atlas, snapIndex, f)
    now += s.count
    before += s.baseline
  }
  const status = now === 0 ? 'ARRIVED' : now < before ? 'BOARDING' : 'SCHEDULED'
  return { status, remaining: now, total: before }
}

export function snapshotStats(atlas, snapIndex) {
  const snap = atlas.snapshots[snapIndex]
  const base = atlas.snapshots[baselineIndex(atlas)]
  return {
    calls: snap.totals.findings,
    baselineCalls: base.totals.findings,
    clear: snap.filesScanned - snap.filesAffected,
    stations: snap.filesScanned,
    ethers: snap.byLib['ethers-v5'] || 0,
    web3: snap.byLib.web3js || 0,
    arrived: atlas.plan.tasks.filter((t) => taskStatus(atlas, snapIndex, t).status === 'ARRIVED').length,
    tasks: atlas.plan.tasks.length,
  }
}

export function taskOf(atlas, fileId) {
  return atlas.plan.tasks.find((t) => t.files.includes(fileId)) || null
}

// Files that import `fileId` (its dependents), from the union import graph.
export function dependentsOf(atlas, fileId) {
  return atlas.files.filter((f) => f.imports.includes(fileId)).map((f) => f.id)
}

export function historyOf(atlas, fileId) {
  return atlas.snapshots.map((s) => (s.present.includes(fileId) ? s.findings[fileId]?.length || 0 : null))
}
