import type { BoardState } from '~/state/types'

function findBlockedCycle(state: BoardState, startId: string) {
  const byId = new Map(state.tasks.map((t) => [t.id, t]))
  const visit = (id: string, trail: string[]): string[] | null => {
    if (trail.includes(id)) return [...trail.slice(trail.indexOf(id)), id]
    const task = byId.get(id)
    if (!task) return null
    for (const blockerId of task.blockedBy) {
      const cycle = visit(blockerId, [...trail, id])
      if (cycle) return cycle
    }
    return null
  }
  return visit(startId, [])
}

function validateBoard(state: BoardState) {
  const problems: string[] = []
  const byId = new Map(state.tasks.map((t) => [t.id, t]))
  const reportedCycles = new Set<string>()

  for (const task of state.tasks) {
    const label = `Task "${task.name}" (id: ${task.id})`

    if (task.done && task.status) {
      problems.push(`${label} is done but still has status ${task.status}`)
    }
    if (task.status === 'failed' && !task.statusReason) {
      problems.push(`${label} failed without a reason`)
    }
    if (
      task.status === 'blocked' &&
      task.blockedBy.length === 0 &&
      !task.statusReason
    ) {
      problems.push(`${label} is blocked without a blocker or a reason`)
    }
    if (task.status !== 'blocked' && task.blockedBy.length > 0) {
      problems.push(`${label} lists blockers but is not blocked`)
    }

    for (const blockerId of task.blockedBy) {
      const blocker = byId.get(blockerId)
      if (!blocker) {
        problems.push(`${label} is blocked by a missing task: ${blockerId}`)
      } else if (blocker.done) {
        problems.push(
          `${label} is blocked by "${blocker.name}", which is already done`
        )
      }
    }

    const cycle = findBlockedCycle(state, task.id)
    if (cycle) {
      const key = [...new Set(cycle)].sort().join(',')
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key)
        problems.push(`Blocking cycle: ${cycle.join(' -> ')}`)
      }
    }
  }

  for (const layer of state.layers) {
    if (layer.status !== 'done') continue
    const open = state.tasks.filter((t) => t.layerId === layer.id && !t.done)
    if (open.length > 0) {
      problems.push(
        `Layer "${layer.name ?? '(unnamed)'}" (id: ${layer.id}) is marked done with ${open.length} open task${open.length === 1 ? '' : 's'}`
      )
    }
  }

  return problems
}

export { validateBoard }
