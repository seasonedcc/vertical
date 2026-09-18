import type { BoardAction } from './actions'
import type { BoardState, Task } from './types'

function releaseBlocker(task: Task, blockerId: string): Task {
  if (!task.blockedBy.includes(blockerId)) return task
  const blockedBy = task.blockedBy.filter((id) => id !== blockerId)
  if (blockedBy.length > 0 || task.status !== 'blocked') {
    return { ...task, blockedBy }
  }
  return { ...task, blockedBy, status: null, statusReason: null }
}

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'RENAME_PROJECT':
      return {
        ...state,
        project: { ...state.project, name: action.name },
      }

    case 'CREATE_TASK':
      return {
        ...state,
        tasks: [
          ...state.tasks,
          {
            id: action.id,
            projectId: state.project.id,
            layerId: action.layerId,
            name: action.name,
            sorting: action.sorting,
            done: false,
            notesHtml: null,
            status: null,
            statusReason: null,
            assignee: null,
            blockedBy: [],
            links: [],
            needsPickup: false,
          },
        ],
      }

    case 'CREATE_TASK_AFTER': {
      const afterTask = state.tasks.find((t) => t.id === action.afterTaskId)
      if (!afterTask) return state

      const nextTask = state.tasks
        .filter(
          (t) =>
            t.layerId === afterTask.layerId && t.sorting > afterTask.sorting
        )
        .sort((a, b) => a.sorting - b.sorting)[0]

      const sorting = nextTask
        ? (afterTask.sorting + nextTask.sorting) / 2
        : afterTask.sorting + 1

      return {
        ...state,
        tasks: [
          ...state.tasks,
          {
            id: action.id,
            projectId: state.project.id,
            layerId: afterTask.layerId,
            name: '',
            sorting,
            done: false,
            notesHtml: null,
            status: null,
            statusReason: null,
            assignee: null,
            blockedBy: [],
            links: [],
            needsPickup: false,
          },
        ],
      }
    }

    case 'RENAME_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, name: action.name } : t
        ),
      }

    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks
          .filter((t) => t.id !== action.taskId)
          .map((t) => releaseBlocker(t, action.taskId)),
      }

    case 'SET_TASK_DONE':
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.taskId) {
            return action.done ? releaseBlocker(t, action.taskId) : t
          }
          if (!action.done) return { ...t, done: false }
          return {
            ...t,
            done: true,
            status: null,
            statusReason: null,
            blockedBy: [],
          }
        }),
      }

    case 'SET_TASK_STATUS':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? {
                ...t,
                done: action.status ? false : t.done,
                status: action.status,
                statusReason: action.reason,
                assignee: action.assignee,
                blockedBy: action.status === 'blocked' ? action.blockedBy : [],
              }
            : t
        ),
      }

    case 'SET_TASK_LINK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? {
                ...t,
                links: [
                  ...t.links.filter((l) => l.label !== action.label),
                  { label: action.label, target: action.target },
                ],
              }
            : t
        ),
      }

    case 'REMOVE_TASK_LINK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? { ...t, links: t.links.filter((l) => l.label !== action.label) }
            : t
        ),
      }

    case 'MOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? { ...t, layerId: action.layerId, sorting: action.sorting }
            : t
        ),
      }

    case 'RENAME_LAYER':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.layerId ? { ...l, name: action.name } : l
        ),
      }

    case 'UNNAME_LAYER':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.layerId ? { ...l, name: null } : l
        ),
      }

    case 'SET_LAYER_STATUS':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.layerId ? { ...l, status: action.status } : l
        ),
      }

    case 'SPLIT_LAYER': {
      const newLayer = {
        id: action.newLayerId,
        sliceId: action.sliceId,
        name: null,
        sorting: action.newLayerSorting,
        status: null as 'done' | null,
      }

      return {
        ...state,
        layers: [...state.layers, newLayer],
        tasks: state.tasks.map((t) =>
          t.layerId === action.currentLayerId && t.sorting > action.taskSorting
            ? { ...t, layerId: action.newLayerId }
            : t
        ),
      }
    }

    case 'UNSPLIT_LAYER': {
      const currentLayer = state.layers.find((l) => l.id === action.layerId)
      if (!currentLayer) return state

      const nextLayer = state.layers
        .filter(
          (l) =>
            l.sliceId === currentLayer.sliceId &&
            l.sorting > currentLayer.sorting
        )
        .sort((a, b) => a.sorting - b.sorting)[0]

      if (!nextLayer) return state

      const maxCurrentSorting = Math.max(
        0,
        ...state.tasks
          .filter((t) => t.layerId === currentLayer.id)
          .map((t) => t.sorting)
      )

      const nextTasks = state.tasks
        .filter((t) => t.layerId === nextLayer.id)
        .sort((a, b) => a.sorting - b.sorting)

      const updatedTasks = state.tasks.map((t) => {
        if (t.layerId !== nextLayer.id) return t
        const index = nextTasks.findIndex((nt) => nt.id === t.id)
        return {
          ...t,
          layerId: currentLayer.id,
          sorting: maxCurrentSorting + index + 1,
        }
      })

      return {
        ...state,
        layers: state.layers.filter((l) => l.id !== nextLayer.id),
        tasks: updatedTasks,
      }
    }

    case 'SET_TASK_PICKUP':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, needsPickup: action.needsPickup } : t
        ),
      }

    case 'SET_TASK_NOTES':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, notesHtml: action.notesHtml } : t
        ),
      }

    case 'RENAME_SLICE':
      return {
        ...state,
        slices: state.slices.map((s) =>
          s.id === action.sliceId ? { ...s, name: action.name } : s
        ),
      }

    case 'UNNAME_SLICE':
      return {
        ...state,
        slices: state.slices.map((s) =>
          s.id === action.sliceId ? { ...s, name: null } : s
        ),
      }

    case 'SORT_SLICES': {
      const boxNumberMap = new Map(
        action.slices.map((s) => [s.id, s.boxNumber])
      )
      return {
        ...state,
        slices: state.slices.map((s) => ({
          ...s,
          boxNumber: boxNumberMap.get(s.id) ?? s.boxNumber,
        })),
      }
    }

    case 'LOAD_STATE':
      return action.state
  }
}

export { boardReducer }
