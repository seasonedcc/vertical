import type { BoardAction } from '~/state/actions'

type SyncState = {
  baseRevision: string
  inFlight: BoardAction | null
  queue: BoardAction[]
  sendId: number
  remotePending: string | null
  conflictAt: number
}

type SyncEvent =
  | { type: 'ENQUEUE'; action: BoardAction }
  | { type: 'SENT'; revision: string }
  | { type: 'REJECTED'; revision: string }
  | { type: 'RETRY' }
  | { type: 'REMOTE'; revision: string }
  | { type: 'RECONCILED'; revision: string }

function coalesceKey(action: BoardAction): string | null {
  switch (action.type) {
    case 'SET_TASK_NOTES':
      return `notes:${action.taskId}`
    case 'RENAME_TASK':
      return `rename-task:${action.taskId}`
    case 'SET_TASK_DONE':
      return `done:${action.taskId}`
    case 'MOVE_TASK':
      return `move:${action.taskId}`
    case 'RENAME_LAYER':
    case 'UNNAME_LAYER':
      return `name-layer:${action.layerId}`
    case 'SET_LAYER_STATUS':
      return `status-layer:${action.layerId}`
    case 'RENAME_SLICE':
    case 'UNNAME_SLICE':
      return `name-slice:${action.sliceId}`
    case 'RENAME_PROJECT':
      return 'rename-project'
    case 'SORT_SLICES':
      return 'sort-slices'
    default:
      return null
  }
}

function initialSyncState(revision: string): SyncState {
  return {
    baseRevision: revision,
    inFlight: null,
    queue: [],
    sendId: 0,
    remotePending: null,
    conflictAt: 0,
  }
}

function promote(state: SyncState): SyncState {
  if (state.inFlight || state.queue.length === 0) return state
  const [next, ...rest] = state.queue
  return { ...state, inFlight: next, queue: rest, sendId: state.sendId + 1 }
}

function enqueue(state: SyncState, action: BoardAction): SyncState {
  const key = coalesceKey(action)
  if (key !== null) {
    const index = state.queue.findIndex((queued) => coalesceKey(queued) === key)
    if (index !== -1) {
      const queue = state.queue.slice()
      queue[index] = action
      return promote({ ...state, queue })
    }
  }
  return promote({ ...state, queue: [...state.queue, action] })
}

function syncReducer(state: SyncState, event: SyncEvent): SyncState {
  switch (event.type) {
    case 'ENQUEUE':
      return enqueue(state, event.action)
    case 'SENT':
      return promote({
        ...state,
        inFlight: null,
        baseRevision: event.revision,
        remotePending:
          state.remotePending === event.revision ? null : state.remotePending,
      })
    case 'REJECTED':
      return {
        ...state,
        inFlight: null,
        queue: [],
        baseRevision: event.revision,
        remotePending: null,
        conflictAt: state.conflictAt + 1,
      }
    case 'RETRY':
      if (!state.inFlight) return state
      return { ...state, sendId: state.sendId + 1 }
    case 'REMOTE':
      if (event.revision === state.baseRevision) return state
      return { ...state, remotePending: event.revision }
    case 'RECONCILED':
      return { ...state, baseRevision: event.revision, remotePending: null }
    default:
      return state
  }
}

export { coalesceKey, initialSyncState, syncReducer }
export type { SyncEvent, SyncState }
