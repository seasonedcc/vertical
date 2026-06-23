import type { BoardAction } from './actions'
import type { BoardState } from './types'

type EntityDiff = {
  added: Set<string>
  removed: Set<string>
  modified: Map<string, Set<string>>
}

type BoardDiff = {
  project: Set<string>
  slices: EntityDiff
  layers: EntityDiff
  tasks: EntityDiff
}

function changedFields(base: object, latest: object): Set<string> {
  const a = base as Record<string, unknown>
  const b = latest as Record<string, unknown>
  const fields = new Set<string>()
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[key] !== b[key]) fields.add(key)
  }
  return fields
}

function diffCollection<T extends { id: string }>(
  base: T[],
  latest: T[]
): EntityDiff {
  const baseById = new Map(base.map((entity) => [entity.id, entity]))
  const latestById = new Map(latest.map((entity) => [entity.id, entity]))
  const added = new Set<string>()
  const removed = new Set<string>()
  const modified = new Map<string, Set<string>>()

  for (const id of latestById.keys()) {
    if (!baseById.has(id)) added.add(id)
  }

  for (const [id, baseEntity] of baseById) {
    const latestEntity = latestById.get(id)
    if (!latestEntity) {
      removed.add(id)
      continue
    }
    const fields = changedFields(baseEntity, latestEntity)
    if (fields.size > 0) modified.set(id, fields)
  }

  return { added, removed, modified }
}

function diffEntities(base: BoardState, latest: BoardState): BoardDiff {
  return {
    project: changedFields(base.project, latest.project),
    slices: diffCollection(base.slices, latest.slices),
    layers: diffCollection(base.layers, latest.layers),
    tasks: diffCollection(base.tasks, latest.tasks),
  }
}

function actionConflicts(
  action: BoardAction,
  base: BoardState,
  latest: BoardState
): boolean {
  const diff = diffEntities(base, latest)
  const taskRemoved = (id: string) => diff.tasks.removed.has(id)
  const taskChanged = (id: string, field: string) =>
    diff.tasks.modified.get(id)?.has(field) ?? false
  const layerRemoved = (id: string) => diff.layers.removed.has(id)
  const layerChanged = (id: string, field: string) =>
    diff.layers.modified.get(id)?.has(field) ?? false
  const sliceRemoved = (id: string) => diff.slices.removed.has(id)
  const sliceChanged = (id: string, field: string) =>
    diff.slices.modified.get(id)?.has(field) ?? false

  switch (action.type) {
    case 'RENAME_PROJECT':
      return diff.project.has('name')

    case 'CREATE_TASK':
      return layerRemoved(action.layerId)

    case 'CREATE_TASK_AFTER':
      return taskRemoved(action.afterTaskId)

    case 'RENAME_TASK':
      return taskRemoved(action.taskId) || taskChanged(action.taskId, 'name')

    case 'DELETE_TASK':
      return false

    case 'SET_TASK_DONE':
      return taskRemoved(action.taskId)

    case 'MOVE_TASK':
      return (
        taskRemoved(action.taskId) ||
        taskChanged(action.taskId, 'layerId') ||
        taskChanged(action.taskId, 'sorting')
      )

    case 'RENAME_LAYER':
    case 'UNNAME_LAYER':
      return (
        layerRemoved(action.layerId) || layerChanged(action.layerId, 'name')
      )

    case 'SET_LAYER_STATUS':
      return layerRemoved(action.layerId)

    case 'SPLIT_LAYER': {
      if (layerRemoved(action.currentLayerId)) return true
      return base.tasks
        .filter(
          (task) =>
            task.layerId === action.currentLayerId &&
            task.sorting > action.taskSorting
        )
        .some(
          (task) =>
            taskRemoved(task.id) ||
            taskChanged(task.id, 'layerId') ||
            taskChanged(task.id, 'sorting')
        )
    }

    case 'UNSPLIT_LAYER': {
      const currentLayer = base.layers.find((l) => l.id === action.layerId)
      if (!currentLayer) return false
      if (layerRemoved(action.layerId)) return true

      const nextLayer = base.layers
        .filter(
          (l) =>
            l.sliceId === currentLayer.sliceId &&
            l.sorting > currentLayer.sorting
        )
        .sort((a, b) => a.sorting - b.sorting)[0]
      if (!nextLayer) return false
      if (layerRemoved(nextLayer.id)) return true

      return base.tasks
        .filter((task) => task.layerId === nextLayer.id)
        .some(
          (task) =>
            taskRemoved(task.id) ||
            taskChanged(task.id, 'layerId') ||
            taskChanged(task.id, 'sorting')
        )
    }

    case 'RENAME_SLICE':
    case 'UNNAME_SLICE':
      return (
        sliceRemoved(action.sliceId) || sliceChanged(action.sliceId, 'name')
      )

    case 'SORT_SLICES':
      return action.slices.some(
        (slice) => sliceRemoved(slice.id) || sliceChanged(slice.id, 'boxNumber')
      )

    case 'SET_TASK_NOTES':
      return (
        taskRemoved(action.taskId) || taskChanged(action.taskId, 'notesHtml')
      )

    case 'LOAD_STATE':
      return false
  }
}

export { actionConflicts, diffEntities }
export type { BoardDiff, EntityDiff }
