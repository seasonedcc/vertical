import { describe, expect, it } from 'vitest'
import { actionConflicts, diffEntities } from './conflict'
import { boardReducer } from './reducer'
import type { BoardState, Layer, Slice, Task } from './types'

function makeSlice(overrides: Partial<Slice> = {}): Slice {
  return {
    id: 'slice-1',
    projectId: 'project-1',
    boxNumber: 1,
    name: null,
    ...overrides,
  }
}

function makeLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'layer-1',
    sliceId: 'slice-1',
    name: null,
    sorting: 1,
    status: null,
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: 'project-1',
    layerId: 'layer-1',
    name: 'Task 1',
    sorting: 1,
    done: false,
    notesHtml: null,
    ...overrides,
  }
}

function makeState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    project: { id: 'project-1', name: 'Test Project' },
    slices: [],
    layers: [],
    tasks: [],
    ...overrides,
  }
}

describe('diffEntities', () => {
  it('detects an added task', () => {
    const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
    const latest = makeState({
      tasks: [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2' })],
    })
    const diff = diffEntities(base, latest)
    expect(diff.tasks.added.has('task-2')).toBe(true)
    expect(diff.tasks.removed.size).toBe(0)
  })

  it('detects a removed task', () => {
    const base = makeState({
      tasks: [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2' })],
    })
    const latest = makeState({ tasks: [makeTask({ id: 'task-1' })] })
    const diff = diffEntities(base, latest)
    expect(diff.tasks.removed.has('task-2')).toBe(true)
  })

  it('reports only the fields that changed on a modified entity', () => {
    const base = makeState({
      tasks: [makeTask({ id: 'task-1', name: 'A', done: false })],
    })
    const latest = makeState({
      tasks: [makeTask({ id: 'task-1', name: 'A', done: true })],
    })
    const diff = diffEntities(base, latest)
    expect(diff.tasks.modified.get('task-1')).toEqual(new Set(['done']))
  })

  it('reports no changes for identical states', () => {
    const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
    const diff = diffEntities(base, base)
    expect(diff.tasks.modified.size).toBe(0)
    expect(diff.tasks.added.size).toBe(0)
    expect(diff.tasks.removed.size).toBe(0)
    expect(diff.project.size).toBe(0)
  })
})

describe('actionConflicts', () => {
  describe('RENAME_PROJECT', () => {
    it('conflicts when the project name changed concurrently', () => {
      const base = makeState()
      const latest = boardReducer(base, {
        type: 'RENAME_PROJECT',
        name: 'Renamed',
      })
      expect(
        actionConflicts({ type: 'RENAME_PROJECT', name: 'Mine' }, base, latest)
      ).toBe(true)
    })

    it('does not conflict with an unrelated change', () => {
      const base = makeState({ layers: [makeLayer({ id: 'layer-1' })] })
      const latest = boardReducer(base, {
        type: 'CREATE_TASK',
        id: 'task-1',
        layerId: 'layer-1',
        name: 'New',
        sorting: 1,
      })
      expect(
        actionConflicts({ type: 'RENAME_PROJECT', name: 'Mine' }, base, latest)
      ).toBe(false)
    })
  })

  describe('CREATE_TASK', () => {
    it('lets two tasks added to the same layer both land', () => {
      const base = makeState({
        layers: [makeLayer({ id: 'layer-1' })],
        tasks: [makeTask({ id: 'task-1', layerId: 'layer-1' })],
      })
      const latest = boardReducer(base, {
        type: 'CREATE_TASK',
        id: 'task-2',
        layerId: 'layer-1',
        name: 'Theirs',
        sorting: 2,
      })
      expect(
        actionConflicts(
          {
            type: 'CREATE_TASK',
            id: 'task-3',
            layerId: 'layer-1',
            name: 'Mine',
            sorting: 3,
          },
          base,
          latest
        )
      ).toBe(false)
    })

    it('conflicts when the parent layer was removed', () => {
      const base = makeState({ layers: [makeLayer({ id: 'layer-1' })] })
      const latest = makeState({ layers: [] })
      expect(
        actionConflicts(
          {
            type: 'CREATE_TASK',
            id: 'task-1',
            layerId: 'layer-1',
            name: 'Mine',
            sorting: 1,
          },
          base,
          latest
        )
      ).toBe(true)
    })
  })

  describe('CREATE_TASK_AFTER', () => {
    it('conflicts when the anchor task was removed', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
      const latest = boardReducer(base, {
        type: 'DELETE_TASK',
        taskId: 'task-1',
      })
      expect(
        actionConflicts(
          { type: 'CREATE_TASK_AFTER', id: 'task-new', afterTaskId: 'task-1' },
          base,
          latest
        )
      ).toBe(true)
    })

    it('does not conflict when another task was added to the layer', () => {
      const base = makeState({
        layers: [makeLayer({ id: 'layer-1' })],
        tasks: [makeTask({ id: 'task-1', layerId: 'layer-1' })],
      })
      const latest = boardReducer(base, {
        type: 'CREATE_TASK',
        id: 'task-2',
        layerId: 'layer-1',
        name: 'Theirs',
        sorting: 2,
      })
      expect(
        actionConflicts(
          { type: 'CREATE_TASK_AFTER', id: 'task-new', afterTaskId: 'task-1' },
          base,
          latest
        )
      ).toBe(false)
    })
  })

  describe('RENAME_TASK', () => {
    it('conflicts when the same task was renamed concurrently', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1', name: 'A' })] })
      const latest = boardReducer(base, {
        type: 'RENAME_TASK',
        taskId: 'task-1',
        name: 'Theirs',
      })
      expect(
        actionConflicts(
          { type: 'RENAME_TASK', taskId: 'task-1', name: 'Mine' },
          base,
          latest
        )
      ).toBe(true)
    })

    it('does not conflict when a disjoint field changed', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1', name: 'A' })] })
      const latest = boardReducer(base, {
        type: 'SET_TASK_DONE',
        taskId: 'task-1',
        done: true,
      })
      expect(
        actionConflicts(
          { type: 'RENAME_TASK', taskId: 'task-1', name: 'Mine' },
          base,
          latest
        )
      ).toBe(false)
    })

    it('conflicts when the task was removed', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
      const latest = boardReducer(base, {
        type: 'DELETE_TASK',
        taskId: 'task-1',
      })
      expect(
        actionConflicts(
          { type: 'RENAME_TASK', taskId: 'task-1', name: 'Mine' },
          base,
          latest
        )
      ).toBe(true)
    })
  })

  describe('DELETE_TASK', () => {
    it('does not conflict when the task was already deleted', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
      const latest = boardReducer(base, {
        type: 'DELETE_TASK',
        taskId: 'task-1',
      })
      expect(
        actionConflicts({ type: 'DELETE_TASK', taskId: 'task-1' }, base, latest)
      ).toBe(false)
    })

    it('does not conflict when the task was renamed concurrently', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
      const latest = boardReducer(base, {
        type: 'RENAME_TASK',
        taskId: 'task-1',
        name: 'Theirs',
      })
      expect(
        actionConflicts({ type: 'DELETE_TASK', taskId: 'task-1' }, base, latest)
      ).toBe(false)
    })
  })

  describe('SET_TASK_DONE', () => {
    it('does not conflict when a disjoint field changed (last write wins)', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
      const latest = boardReducer(base, {
        type: 'SET_TASK_NOTES',
        taskId: 'task-1',
        notesHtml: '<p>note</p>',
      })
      expect(
        actionConflicts(
          { type: 'SET_TASK_DONE', taskId: 'task-1', done: true },
          base,
          latest
        )
      ).toBe(false)
    })

    it('conflicts when the task was removed', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
      const latest = boardReducer(base, {
        type: 'DELETE_TASK',
        taskId: 'task-1',
      })
      expect(
        actionConflicts(
          { type: 'SET_TASK_DONE', taskId: 'task-1', done: true },
          base,
          latest
        )
      ).toBe(true)
    })
  })

  describe('MOVE_TASK', () => {
    it('conflicts when the task position changed concurrently', () => {
      const base = makeState({
        tasks: [makeTask({ id: 'task-1', layerId: 'layer-1', sorting: 1 })],
      })
      const latest = boardReducer(base, {
        type: 'MOVE_TASK',
        taskId: 'task-1',
        layerId: 'layer-1',
        sorting: 5,
      })
      expect(
        actionConflicts(
          {
            type: 'MOVE_TASK',
            taskId: 'task-1',
            layerId: 'layer-2',
            sorting: 9,
          },
          base,
          latest
        )
      ).toBe(true)
    })

    it('does not conflict when only the name changed', () => {
      const base = makeState({
        tasks: [makeTask({ id: 'task-1', layerId: 'layer-1', sorting: 1 })],
      })
      const latest = boardReducer(base, {
        type: 'RENAME_TASK',
        taskId: 'task-1',
        name: 'Theirs',
      })
      expect(
        actionConflicts(
          {
            type: 'MOVE_TASK',
            taskId: 'task-1',
            layerId: 'layer-2',
            sorting: 9,
          },
          base,
          latest
        )
      ).toBe(false)
    })
  })

  describe('layer name actions', () => {
    it('conflicts when the layer name changed concurrently', () => {
      const base = makeState({ layers: [makeLayer({ id: 'layer-1' })] })
      const latest = boardReducer(base, {
        type: 'RENAME_LAYER',
        layerId: 'layer-1',
        name: 'Theirs',
      })
      expect(
        actionConflicts(
          { type: 'RENAME_LAYER', layerId: 'layer-1', name: 'Mine' },
          base,
          latest
        )
      ).toBe(true)
    })

    it('does not conflict when only the status changed', () => {
      const base = makeState({ layers: [makeLayer({ id: 'layer-1' })] })
      const latest = boardReducer(base, {
        type: 'SET_LAYER_STATUS',
        layerId: 'layer-1',
        status: 'done',
      })
      expect(
        actionConflicts(
          { type: 'RENAME_LAYER', layerId: 'layer-1', name: 'Mine' },
          base,
          latest
        )
      ).toBe(false)
    })
  })

  describe('SET_LAYER_STATUS', () => {
    it('does not conflict when the layer name changed (last write wins)', () => {
      const base = makeState({ layers: [makeLayer({ id: 'layer-1' })] })
      const latest = boardReducer(base, {
        type: 'RENAME_LAYER',
        layerId: 'layer-1',
        name: 'Theirs',
      })
      expect(
        actionConflicts(
          { type: 'SET_LAYER_STATUS', layerId: 'layer-1', status: 'done' },
          base,
          latest
        )
      ).toBe(false)
    })
  })

  describe('SPLIT_LAYER', () => {
    const base = makeState({
      layers: [makeLayer({ id: 'layer-1', sliceId: 'slice-1', sorting: 1 })],
      tasks: [
        makeTask({ id: 'task-1', layerId: 'layer-1', sorting: 1 }),
        makeTask({ id: 'task-2', layerId: 'layer-1', sorting: 2 }),
        makeTask({ id: 'task-3', layerId: 'layer-1', sorting: 3 }),
      ],
    })
    const split = {
      type: 'SPLIT_LAYER' as const,
      taskId: 'task-1',
      newLayerId: 'layer-2',
      currentLayerId: 'layer-1',
      sliceId: 'slice-1',
      taskSorting: 1,
      newLayerSorting: 2,
    }

    it('conflicts when a task that would move was moved away concurrently', () => {
      const latest = boardReducer(base, {
        type: 'MOVE_TASK',
        taskId: 'task-2',
        layerId: 'layer-other',
        sorting: 1,
      })
      expect(actionConflicts(split, base, latest)).toBe(true)
    })

    it('does not conflict when a moving task was only renamed', () => {
      const latest = boardReducer(base, {
        type: 'RENAME_TASK',
        taskId: 'task-2',
        name: 'Theirs',
      })
      expect(actionConflicts(split, base, latest)).toBe(false)
    })

    it('does not conflict when the anchor task (which stays) is renamed', () => {
      const latest = boardReducer(base, {
        type: 'RENAME_TASK',
        taskId: 'task-1',
        name: 'Theirs',
      })
      expect(actionConflicts(split, base, latest)).toBe(false)
    })
  })

  describe('UNSPLIT_LAYER', () => {
    const base = makeState({
      layers: [
        makeLayer({ id: 'layer-1', sliceId: 'slice-1', sorting: 1 }),
        makeLayer({ id: 'layer-2', sliceId: 'slice-1', sorting: 2 }),
      ],
      tasks: [
        makeTask({ id: 'task-1', layerId: 'layer-1', sorting: 1 }),
        makeTask({ id: 'task-2', layerId: 'layer-2', sorting: 1 }),
        makeTask({ id: 'task-3', layerId: 'layer-2', sorting: 2 }),
      ],
    })

    it('conflicts when the next layer was already merged away', () => {
      const latest = boardReducer(base, {
        type: 'UNSPLIT_LAYER',
        layerId: 'layer-1',
      })
      expect(
        actionConflicts(
          { type: 'UNSPLIT_LAYER', layerId: 'layer-1' },
          base,
          latest
        )
      ).toBe(true)
    })

    it('conflicts when a task in the next layer was moved concurrently', () => {
      const latest = boardReducer(base, {
        type: 'MOVE_TASK',
        taskId: 'task-2',
        layerId: 'layer-1',
        sorting: 9,
      })
      expect(
        actionConflicts(
          { type: 'UNSPLIT_LAYER', layerId: 'layer-1' },
          base,
          latest
        )
      ).toBe(true)
    })

    it('does not conflict with an unrelated change in the current layer', () => {
      const latest = boardReducer(base, {
        type: 'RENAME_TASK',
        taskId: 'task-1',
        name: 'Theirs',
      })
      expect(
        actionConflicts(
          { type: 'UNSPLIT_LAYER', layerId: 'layer-1' },
          base,
          latest
        )
      ).toBe(false)
    })
  })

  describe('slice name actions', () => {
    it('conflicts when the slice name changed concurrently', () => {
      const base = makeState({ slices: [makeSlice({ id: 'slice-1' })] })
      const latest = boardReducer(base, {
        type: 'RENAME_SLICE',
        sliceId: 'slice-1',
        name: 'Theirs',
      })
      expect(
        actionConflicts(
          { type: 'RENAME_SLICE', sliceId: 'slice-1', name: 'Mine' },
          base,
          latest
        )
      ).toBe(true)
    })

    it('does not conflict when only the box number changed', () => {
      const base = makeState({
        slices: [makeSlice({ id: 'slice-1', boxNumber: 1 })],
      })
      const latest = boardReducer(base, {
        type: 'SORT_SLICES',
        slices: [{ id: 'slice-1', boxNumber: 5 }],
      })
      expect(
        actionConflicts(
          { type: 'RENAME_SLICE', sliceId: 'slice-1', name: 'Mine' },
          base,
          latest
        )
      ).toBe(false)
    })
  })

  describe('SORT_SLICES', () => {
    const base = makeState({
      slices: [
        makeSlice({ id: 'slice-1', boxNumber: 1 }),
        makeSlice({ id: 'slice-2', boxNumber: 2 }),
        makeSlice({ id: 'slice-3', boxNumber: 3 }),
      ],
    })

    it('conflicts when a listed slice was reordered concurrently', () => {
      const latest = boardReducer(base, {
        type: 'SORT_SLICES',
        slices: [
          { id: 'slice-1', boxNumber: 2 },
          { id: 'slice-2', boxNumber: 1 },
        ],
      })
      expect(
        actionConflicts(
          {
            type: 'SORT_SLICES',
            slices: [
              { id: 'slice-1', boxNumber: 3 },
              { id: 'slice-3', boxNumber: 1 },
            ],
          },
          base,
          latest
        )
      ).toBe(true)
    })

    it('does not conflict when only a non-listed slice changed', () => {
      const latest = boardReducer(base, {
        type: 'RENAME_SLICE',
        sliceId: 'slice-2',
        name: 'Theirs',
      })
      expect(
        actionConflicts(
          {
            type: 'SORT_SLICES',
            slices: [
              { id: 'slice-1', boxNumber: 3 },
              { id: 'slice-3', boxNumber: 1 },
            ],
          },
          base,
          latest
        )
      ).toBe(false)
    })
  })

  describe('SET_TASK_NOTES', () => {
    it('conflicts when the notes changed concurrently', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
      const latest = boardReducer(base, {
        type: 'SET_TASK_NOTES',
        taskId: 'task-1',
        notesHtml: '<p>theirs</p>',
      })
      expect(
        actionConflicts(
          {
            type: 'SET_TASK_NOTES',
            taskId: 'task-1',
            notesHtml: '<p>mine</p>',
          },
          base,
          latest
        )
      ).toBe(true)
    })

    it('does not conflict when a disjoint field changed', () => {
      const base = makeState({ tasks: [makeTask({ id: 'task-1' })] })
      const latest = boardReducer(base, {
        type: 'SET_TASK_DONE',
        taskId: 'task-1',
        done: true,
      })
      expect(
        actionConflicts(
          {
            type: 'SET_TASK_NOTES',
            taskId: 'task-1',
            notesHtml: '<p>mine</p>',
          },
          base,
          latest
        )
      ).toBe(false)
    })
  })
})
