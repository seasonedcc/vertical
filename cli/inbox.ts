import type { BoardAction } from '~/state/actions'
import type { BoardState } from '~/state/types'

function editedTaskId(action: BoardAction) {
  switch (action.type) {
    case 'CREATE_TASK':
    case 'CREATE_TASK_AFTER':
      return action.id
    case 'RENAME_TASK':
    case 'SET_TASK_DONE':
    case 'SET_TASK_NOTES':
    case 'MOVE_TASK':
      return action.taskId
    default:
      return null
  }
}

function flagBrowserEdits(state: BoardState, actions: BoardAction[]) {
  const editedIds = new Set(actions.map(editedTaskId).filter(Boolean))
  if (editedIds.size === 0) return state

  return {
    ...state,
    tasks: state.tasks.map((t) =>
      editedIds.has(t.id) ? { ...t, needsPickup: true } : t
    ),
  }
}

function listInbox(state: BoardState) {
  return state.tasks
    .filter((t) => t.needsPickup)
    .map((task) => {
      const layer = state.layers.find((l) => l.id === task.layerId)
      const slice = state.slices.find((s) => s.id === layer?.sliceId)
      return {
        id: task.id,
        name: task.name,
        done: task.done,
        notesHtml: task.notesHtml,
        layerId: task.layerId,
        layer: layer?.name ?? null,
        box: slice?.boxNumber ?? null,
        boxName: slice?.name ?? null,
      }
    })
}

export { flagBrowserEdits, listInbox }
