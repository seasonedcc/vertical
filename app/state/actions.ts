import type { BoardState, TaskStatus } from './types'

type BoardAction =
  | { type: 'RENAME_PROJECT'; name: string }
  | {
      type: 'CREATE_TASK'
      id: string
      layerId: string
      name: string
      sorting: number
    }
  | { type: 'CREATE_TASK_AFTER'; id: string; afterTaskId: string }
  | { type: 'RENAME_TASK'; taskId: string; name: string }
  | { type: 'DELETE_TASK'; taskId: string }
  | { type: 'SET_TASK_DONE'; taskId: string; done: boolean }
  | {
      type: 'MOVE_TASK'
      taskId: string
      layerId: string
      sorting: number
    }
  | { type: 'RENAME_LAYER'; layerId: string; name: string }
  | { type: 'UNNAME_LAYER'; layerId: string }
  | { type: 'SET_LAYER_STATUS'; layerId: string; status: 'done' | null }
  | {
      type: 'SPLIT_LAYER'
      taskId: string
      newLayerId: string
      currentLayerId: string
      sliceId: string
      taskSorting: number
      newLayerSorting: number
    }
  | { type: 'UNSPLIT_LAYER'; layerId: string }
  | { type: 'RENAME_SLICE'; sliceId: string; name: string }
  | { type: 'UNNAME_SLICE'; sliceId: string }
  | {
      type: 'SORT_SLICES'
      slices: Array<{ id: string; boxNumber: number }>
    }
  | { type: 'SET_TASK_NOTES'; taskId: string; notesHtml: string | null }
  | {
      type: 'SET_TASK_STATUS'
      taskId: string
      status: TaskStatus | null
      reason: string | null
      assignee: string | null
      blockedBy: string[]
    }
  | { type: 'SET_TASK_LINK'; taskId: string; label: string; target: string }
  | { type: 'REMOVE_TASK_LINK'; taskId: string; label: string }
  | { type: 'SET_TASK_PICKUP'; taskId: string; needsPickup: boolean }
  | { type: 'LOAD_STATE'; state: BoardState }

export type { BoardAction }
