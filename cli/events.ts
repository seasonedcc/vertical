import type { BoardAction } from '~/state/actions'
import type { BoardState, Task } from '~/state/types'

type EventDraft = { summary: string; taskId: string | null }

function taskPlace(state: BoardState, task: Task) {
  const layer = state.layers.find((l) => l.id === task.layerId)
  const slice = state.slices.find((s) => s.id === layer?.sliceId)
  const boxName = slice?.name ?? `Box ${slice?.boxNumber ?? '?'}`
  return layer?.name ? `${boxName} / ${layer.name}` : boxName
}

function describeStatus(task: Task) {
  if (task.status === 'active') {
    return task.assignee ? `is active (${task.assignee})` : 'is active'
  }
  if (task.status === 'failed') {
    return task.statusReason ? `failed: ${task.statusReason}` : 'failed'
  }
  if (task.status === 'blocked') {
    return task.statusReason ? `is blocked: ${task.statusReason}` : 'is blocked'
  }
  return 'has no status'
}

function describeTarget(
  before: BoardState,
  after: BoardState,
  action: BoardAction
): EventDraft[] {
  const taskBefore = (id: string) => before.tasks.find((t) => t.id === id)
  const taskAfter = (id: string) => after.tasks.find((t) => t.id === id)
  const layerName = (id: string) =>
    before.layers.find((l) => l.id === id)?.name ?? '(unnamed layer)'
  const sliceName = (id: string) => {
    const slice = before.slices.find((s) => s.id === id)
    return slice?.name ?? `Box ${slice?.boxNumber ?? '?'}`
  }

  switch (action.type) {
    case 'RENAME_PROJECT':
      return [
        { summary: `Renamed the project to "${action.name}"`, taskId: null },
      ]

    case 'CREATE_TASK':
    case 'CREATE_TASK_AFTER': {
      const task = taskAfter(action.id)
      if (!task) return []
      const name = task.name ? `"${task.name}"` : 'a task'
      return [
        {
          summary: `Added ${name} to ${taskPlace(after, task)}`,
          taskId: task.id,
        },
      ]
    }

    case 'RENAME_TASK': {
      const task = taskBefore(action.taskId)
      if (!task || task.name === action.name) return []
      const summary = task.name
        ? `Renamed "${task.name}" to "${action.name}"`
        : `Named a task "${action.name}"`
      return [{ summary, taskId: task.id }]
    }

    case 'DELETE_TASK': {
      const task = taskBefore(action.taskId)
      if (!task) return []
      return [{ summary: `Deleted "${task.name}"`, taskId: task.id }]
    }

    case 'SET_TASK_DONE': {
      const task = taskBefore(action.taskId)
      if (!task || task.done === action.done) return []
      const summary = action.done
        ? `Marked "${task.name}" done`
        : `Reopened "${task.name}"`
      return [{ summary, taskId: task.id }]
    }

    case 'SET_TASK_STATUS': {
      const task = taskAfter(action.taskId)
      if (!task) return []
      return [
        { summary: `"${task.name}" ${describeStatus(task)}`, taskId: task.id },
      ]
    }

    case 'SET_TASK_LINK': {
      const task = taskAfter(action.taskId)
      if (!task) return []
      return [
        {
          summary: `Linked "${task.name}" to ${action.label}: ${action.target}`,
          taskId: task.id,
        },
      ]
    }

    case 'REMOVE_TASK_LINK': {
      const task = taskAfter(action.taskId)
      if (!task) return []
      return [
        {
          summary: `Removed the ${action.label} link from "${task.name}"`,
          taskId: task.id,
        },
      ]
    }

    case 'SET_TASK_PICKUP': {
      const task = taskAfter(action.taskId)
      if (!task || action.needsPickup) return []
      return [{ summary: `Acknowledged "${task.name}"`, taskId: task.id }]
    }

    case 'SET_TASK_NOTES': {
      const task = taskAfter(action.taskId)
      if (!task) return []
      const verb = action.notesHtml ? 'Edited' : 'Cleared'
      return [
        { summary: `${verb} the notes on "${task.name}"`, taskId: task.id },
      ]
    }

    case 'MOVE_TASK': {
      const task = taskAfter(action.taskId)
      const previous = taskBefore(action.taskId)
      if (!task || !previous || previous.layerId === task.layerId) return []
      return [
        {
          summary: `Moved "${task.name}" to ${taskPlace(after, task)}`,
          taskId: task.id,
        },
      ]
    }

    case 'RENAME_LAYER':
      return [{ summary: `Renamed a layer to "${action.name}"`, taskId: null }]

    case 'UNNAME_LAYER':
      return [
        {
          summary: `Cleared the name of layer "${layerName(action.layerId)}"`,
          taskId: null,
        },
      ]

    case 'SET_LAYER_STATUS': {
      const name = layerName(action.layerId)
      const summary =
        action.status === 'done'
          ? `Marked layer "${name}" done`
          : `Reopened layer "${name}"`
      return [{ summary, taskId: null }]
    }

    case 'SPLIT_LAYER':
      return [
        {
          summary: `Split a layer in ${sliceName(action.sliceId)}`,
          taskId: null,
        },
      ]

    case 'UNSPLIT_LAYER':
      return [
        {
          summary: `Merged layer "${layerName(action.layerId)}"`,
          taskId: null,
        },
      ]

    case 'RENAME_SLICE':
      return [
        {
          summary: `Renamed ${sliceName(action.sliceId)} to "${action.name}"`,
          taskId: null,
        },
      ]

    case 'UNNAME_SLICE':
      return [
        {
          summary: `Cleared the name of ${sliceName(action.sliceId)}`,
          taskId: null,
        },
      ]

    case 'SORT_SLICES':
      return [{ summary: 'Rearranged the boxes', taskId: null }]

    case 'LOAD_STATE':
      return []
  }
}

function describeReleased(before: BoardState, after: BoardState) {
  return after.tasks
    .filter((task) => {
      const previous = before.tasks.find((t) => t.id === task.id)
      return (
        previous?.status === 'blocked' && task.status === null && !task.done
      )
    })
    .map((task) => ({ summary: `Unblocked "${task.name}"`, taskId: task.id }))
}

function describeAction(
  before: BoardState,
  after: BoardState,
  action: BoardAction
): EventDraft[] {
  const events = describeTarget(before, after, action)
  if (action.type !== 'SET_TASK_DONE' && action.type !== 'DELETE_TASK') {
    return events
  }
  return [...events, ...describeReleased(before, after)]
}

export { describeAction }
export type { EventDraft }
