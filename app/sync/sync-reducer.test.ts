import { describe, expect, it } from 'vitest'
import type { BoardAction } from '~/state/actions'
import { coalesceKey, initialSyncState, syncReducer } from './sync-reducer'

function renameTask(taskId: string, name: string): BoardAction {
  return { type: 'RENAME_TASK', taskId, name }
}

function createTask(id: string): BoardAction {
  return { type: 'CREATE_TASK', id, layerId: 'layer-1', name: id, sorting: 1 }
}

describe('syncReducer', () => {
  it('promotes the first enqueued action into flight', () => {
    const state = syncReducer(initialSyncState('rev-0'), {
      type: 'ENQUEUE',
      action: renameTask('task-1', 'A'),
    })

    expect(state.inFlight).toEqual(renameTask('task-1', 'A'))
    expect(state.queue).toEqual([])
    expect(state.sendId).toBe(1)
  })

  it('keeps only one action in flight (single-flight)', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('b') })

    expect(state.inFlight).toEqual(createTask('a'))
    expect(state.queue).toEqual([createTask('b')])
    expect(state.sendId).toBe(1)
  })

  it('promotes the next queued action on SENT and advances the revision', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('b') })
    state = syncReducer(state, { type: 'SENT', revision: 'rev-1' })

    expect(state.baseRevision).toBe('rev-1')
    expect(state.inFlight).toEqual(createTask('b'))
    expect(state.queue).toEqual([])
    expect(state.sendId).toBe(2)
  })

  it('goes idle when the last action is confirmed', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, { type: 'SENT', revision: 'rev-1' })

    expect(state.inFlight).toBeNull()
    expect(state.queue).toEqual([])
    expect(state.sendId).toBe(1)
  })

  it('coalesces pending actions on the same target, keeping the newest', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, {
      type: 'ENQUEUE',
      action: renameTask('task-1', 'first'),
    })
    state = syncReducer(state, {
      type: 'ENQUEUE',
      action: renameTask('task-1', 'second'),
    })

    expect(state.inFlight).toEqual(createTask('a'))
    expect(state.queue).toEqual([renameTask('task-1', 'second')])
  })

  it('never coalesces distinct create actions', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('b') })
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('c') })

    expect(state.queue).toEqual([createTask('b'), createTask('c')])
  })

  it('coalesces a rename and an unname of the same layer', () => {
    expect(
      coalesceKey({ type: 'RENAME_LAYER', layerId: 'l1', name: 'x' })
    ).toBe(coalesceKey({ type: 'UNNAME_LAYER', layerId: 'l1' }))
  })

  it('ignores a remote event that echoes our own revision', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, { type: 'SENT', revision: 'rev-1' })
    const after = syncReducer(state, { type: 'REMOTE', revision: 'rev-1' })

    expect(after.remotePending).toBeNull()
    expect(after).toBe(state)
  })

  it('records a genuine remote change as pending', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'REMOTE', revision: 'rev-9' })

    expect(state.remotePending).toBe('rev-9')
  })

  it('clears remote-pending when SENT confirms the same revision (race)', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, { type: 'REMOTE', revision: 'rev-1' })
    expect(state.remotePending).toBe('rev-1')

    state = syncReducer(state, { type: 'SENT', revision: 'rev-1' })
    expect(state.remotePending).toBeNull()
  })

  it('keeps remote-pending while other work is in flight (defer until drain)', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('b') })
    state = syncReducer(state, { type: 'REMOTE', revision: 'rev-remote' })
    state = syncReducer(state, { type: 'SENT', revision: 'rev-1' })

    expect(state.remotePending).toBe('rev-remote')
    expect(state.inFlight).toEqual(createTask('b'))
  })

  it('clears remote-pending and advances on RECONCILED', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'REMOTE', revision: 'rev-remote' })
    state = syncReducer(state, { type: 'RECONCILED', revision: 'rev-remote' })

    expect(state.remotePending).toBeNull()
    expect(state.baseRevision).toBe('rev-remote')
  })

  it('rolls back the queue and raises a conflict on REJECTED', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('b') })
    state = syncReducer(state, { type: 'REJECTED', revision: 'rev-latest' })

    expect(state.inFlight).toBeNull()
    expect(state.queue).toEqual([])
    expect(state.baseRevision).toBe('rev-latest')
    expect(state.conflictAt).toBe(1)
  })

  it('re-triggers the send effect on RETRY without losing the in-flight action', () => {
    let state = initialSyncState('rev-0')
    state = syncReducer(state, { type: 'ENQUEUE', action: createTask('a') })
    const before = state.sendId
    state = syncReducer(state, { type: 'RETRY' })

    expect(state.inFlight).toEqual(createTask('a'))
    expect(state.sendId).toBe(before + 1)
  })

  it('ignores RETRY when nothing is in flight', () => {
    const state = initialSyncState('rev-0')
    expect(syncReducer(state, { type: 'RETRY' })).toBe(state)
  })
})
