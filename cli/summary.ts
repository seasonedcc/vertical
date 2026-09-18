import { sortBy } from '~/lib/utils'
import type { BoardState, Task } from '~/state/types'

function countTasks(tasks: Task[]) {
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.done).length,
    active: tasks.filter((t) => t.status === 'active').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
  }
}

function summarizeBoard(state: BoardState, boxId?: string) {
  const slices = sortBy(state.slices, 'boxNumber').filter(
    (s) => !boxId || s.id === boxId
  )

  const boxes = slices
    .map((slice) => {
      const layers = sortBy(
        state.layers.filter((l) => l.sliceId === slice.id),
        'sorting'
      )
      const layerSummaries = layers.map((layer) => {
        const tasks = state.tasks.filter((t) => t.layerId === layer.id)
        return {
          id: layer.id,
          name: layer.name,
          status: layer.status,
          ...countTasks(tasks),
        }
      })
      const tasks = state.tasks.filter((t) =>
        layers.some((l) => l.id === t.layerId)
      )
      return {
        box: slice.boxNumber,
        id: slice.id,
        name: slice.name,
        ...countTasks(tasks),
        layers: layerSummaries,
      }
    })
    .filter((box) => box.name || box.total > 0)

  const scopedTasks = state.tasks.filter((t) =>
    boxes.some((box) => box.layers.some((l) => l.id === t.layerId))
  )

  const attention = scopedTasks
    .filter((t) => t.status === 'failed' || t.status === 'blocked')
    .map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      reason: t.statusReason,
      blockedBy: t.blockedBy,
    }))

  return {
    project: state.project.name,
    ...countTasks(scopedTasks),
    needsPickup: scopedTasks.filter((t) => t.needsPickup).length,
    boxes,
    attention,
  }
}

function formatCounts(counts: ReturnType<typeof countTasks>) {
  const parts = [`${counts.done}/${counts.total} done`]
  if (counts.active > 0) parts.push(`${counts.active} active`)
  if (counts.failed > 0) parts.push(`${counts.failed} failed`)
  if (counts.blocked > 0) parts.push(`${counts.blocked} blocked`)
  return parts.join(' · ')
}

function showSummary(state: BoardState, boxId?: string) {
  const summary = summarizeBoard(state, boxId)
  const byId = new Map(state.tasks.map((t) => [t.id, t]))
  const pickup =
    summary.needsPickup > 0 ? ` · ${summary.needsPickup} need pickup` : ''

  console.log(`${summary.project} · ${formatCounts(summary)}${pickup}`)

  for (const box of summary.boxes) {
    const layers = box.layers
      .map((layer, index) => {
        const name = layer.name ?? `Layer ${index + 1}`
        if (layer.status === 'done') return `${name} done`
        return `${name} ${layer.done}/${layer.total}`
      })
      .join(' | ')
    console.log(
      `${box.box} ${box.name ?? '(untitled)'} · ${formatCounts(box)} · ${layers}`
    )
  }

  for (const item of summary.attention) {
    const blockers = item.blockedBy
      .map((id) => byId.get(id)?.name ?? id)
      .join(', ')
    const detail = [item.reason, blockers && `waits on ${blockers}`]
      .filter(Boolean)
      .join(' · ')
    console.log(`! ${item.status}: ${item.name}${detail ? ` · ${detail}` : ''}`)
  }
}

export { showSummary, summarizeBoard }
