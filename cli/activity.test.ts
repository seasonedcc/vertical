import { describe, expect, it } from 'vitest'
import type { BoardState, Layer, Project, Slice, Task } from '~/state/types'
import { diffStates } from './activity'

function project(overrides: Partial<Project> = {}): Project {
  return { id: 'p1', name: 'Project', ...overrides }
}

function slice(overrides: Partial<Slice> = {}): Slice {
  return {
    id: 's1',
    projectId: 'p1',
    boxNumber: 1,
    name: null,
    ...overrides,
  }
}

function layer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'l1',
    sliceId: 's1',
    name: null,
    sorting: 1,
    status: null,
    ...overrides,
  }
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    projectId: 'p1',
    layerId: 'l1',
    name: 'task',
    sorting: 1,
    done: false,
    notesHtml: null,
    ...overrides,
  }
}

function state(overrides: Partial<BoardState> = {}): BoardState {
  return {
    project: project(),
    slices: [slice()],
    layers: [layer()],
    tasks: [],
    ...overrides,
  }
}

describe('diffStates', () => {
  it('emits project-created and task events when before is null', () => {
    const after = state({
      slices: [slice({ name: 'UI' })],
      tasks: [task({ id: 't1', name: 'first', done: false })],
    })
    const changes = diffStates(null, after)
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'project-created' })
    )
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'slice-named', sliceId: 's1' })
    )
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'task-added', taskId: 't1' })
    )
  })

  it('treats a new task added as already done as task-completed', () => {
    const before = state()
    const after = state({
      tasks: [task({ id: 't1', name: 'X', done: true })],
    })
    const changes = diffStates(before, after)
    expect(changes).toEqual([
      expect.objectContaining({
        kind: 'task-completed',
        taskId: 't1',
        text: expect.stringContaining('already done'),
      }),
    ])
  })

  it('emits task-completed when done flips false to true', () => {
    const before = state({
      tasks: [task({ id: 't1', name: 'X', done: false })],
    })
    const after = state({
      tasks: [task({ id: 't1', name: 'X', done: true })],
    })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'task-completed', taskId: 't1' }),
    ])
  })

  it('emits task-uncompleted when done flips true to false', () => {
    const before = state({
      tasks: [task({ id: 't1', done: true })],
    })
    const after = state({
      tasks: [task({ id: 't1', done: false })],
    })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'task-uncompleted', taskId: 't1' }),
    ])
  })

  it('emits task-renamed when name changes', () => {
    const before = state({
      tasks: [task({ id: 't1', name: 'old' })],
    })
    const after = state({
      tasks: [task({ id: 't1', name: 'new' })],
    })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'task-renamed', taskId: 't1' }),
    ])
  })

  it('emits task-removed when a task disappears', () => {
    const before = state({
      tasks: [task({ id: 't1', name: 'gone' })],
    })
    const after = state({ tasks: [] })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'task-removed', taskId: 't1' }),
    ])
  })

  it('emits task-moved when layerId changes', () => {
    const before = state({
      layers: [layer({ id: 'l1' }), layer({ id: 'l2', sorting: 2 })],
      tasks: [task({ id: 't1', layerId: 'l1' })],
    })
    const after = state({
      layers: [layer({ id: 'l1' }), layer({ id: 'l2', sorting: 2 })],
      tasks: [task({ id: 't1', layerId: 'l2' })],
    })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'task-moved', taskId: 't1' }),
    ])
  })

  it('emits layer-closed when status changes to done', () => {
    const before = state({ layers: [layer({ status: null })] })
    const after = state({ layers: [layer({ status: 'done' })] })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'layer-closed', layerId: 'l1' }),
    ])
  })

  it('emits layer-reopened when done is undone', () => {
    const before = state({ layers: [layer({ status: 'done' })] })
    const after = state({ layers: [layer({ status: null })] })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'layer-reopened', layerId: 'l1' }),
    ])
  })

  it('emits slice-named when a null name becomes a string', () => {
    const before = state({ slices: [slice({ name: null })] })
    const after = state({ slices: [slice({ name: 'Bugs' })] })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'slice-named', sliceId: 's1' }),
    ])
  })

  it('emits slice-renamed when one string becomes another', () => {
    const before = state({ slices: [slice({ name: 'Old' })] })
    const after = state({ slices: [slice({ name: 'New' })] })
    expect(diffStates(before, after)).toEqual([
      expect.objectContaining({ kind: 'slice-renamed', sliceId: 's1' }),
    ])
  })

  it('ignores sorting-only and notesHtml-only changes', () => {
    const before = state({
      tasks: [task({ id: 't1', sorting: 1, notesHtml: null })],
    })
    const after = state({
      tasks: [task({ id: 't1', sorting: 2, notesHtml: '<p>x</p>' })],
    })
    expect(diffStates(before, after)).toEqual([])
  })
})
