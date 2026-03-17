import { describe, expect, it } from 'vitest'
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

describe('boardReducer', () => {
  describe('RENAME_PROJECT', () => {
    it('updates the project name', () => {
      const state = makeState()
      const result = boardReducer(state, {
        type: 'RENAME_PROJECT',
        name: 'New Name',
      })
      expect(result.project.name).toBe('New Name')
    })

    it('preserves the project id', () => {
      const state = makeState()
      const result = boardReducer(state, {
        type: 'RENAME_PROJECT',
        name: 'New Name',
      })
      expect(result.project.id).toBe('project-1')
    })
  })

  describe('CREATE_TASK', () => {
    it('appends a new task', () => {
      const state = makeState({
        tasks: [makeTask()],
      })
      const result = boardReducer(state, {
        type: 'CREATE_TASK',
        id: 'task-2',
        layerId: 'layer-1',
        name: 'Task 2',
        sorting: 2,
      })
      expect(result.tasks).toHaveLength(2)
      expect(result.tasks[1]).toEqual({
        id: 'task-2',
        projectId: 'project-1',
        layerId: 'layer-1',
        name: 'Task 2',
        sorting: 2,
        done: false,
        notesHtml: null,
      })
    })

    it('does not modify existing tasks', () => {
      const existing = makeTask()
      const state = makeState({ tasks: [existing] })
      const result = boardReducer(state, {
        type: 'CREATE_TASK',
        id: 'task-2',
        layerId: 'layer-1',
        name: 'Task 2',
        sorting: 2,
      })
      expect(result.tasks[0]).toEqual(existing)
    })
  })

  describe('CREATE_TASK_AFTER', () => {
    it('places a new task between two existing tasks', () => {
      const state = makeState({
        tasks: [
          makeTask({ id: 'task-1', sorting: 1 }),
          makeTask({ id: 'task-2', sorting: 3 }),
        ],
      })
      const result = boardReducer(state, {
        type: 'CREATE_TASK_AFTER',
        id: 'task-new',
        afterTaskId: 'task-1',
      })
      expect(result.tasks).toHaveLength(3)
      const newTask = result.tasks.find((t) => t.id === 'task-new')
      expect(newTask?.sorting).toBe(2)
      expect(newTask?.name).toBe('')
      expect(newTask?.done).toBe(false)
    })

    it('places a new task after the last task in the layer', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1', sorting: 5 })],
      })
      const result = boardReducer(state, {
        type: 'CREATE_TASK_AFTER',
        id: 'task-new',
        afterTaskId: 'task-1',
      })
      const newTask = result.tasks.find((t) => t.id === 'task-new')
      expect(newTask?.sorting).toBe(6)
    })

    it('only considers tasks in the same layer for midpoint calculation', () => {
      const state = makeState({
        tasks: [
          makeTask({ id: 'task-1', layerId: 'layer-1', sorting: 1 }),
          makeTask({ id: 'task-2', layerId: 'layer-2', sorting: 2 }),
          makeTask({ id: 'task-3', layerId: 'layer-1', sorting: 5 }),
        ],
      })
      const result = boardReducer(state, {
        type: 'CREATE_TASK_AFTER',
        id: 'task-new',
        afterTaskId: 'task-1',
      })
      const newTask = result.tasks.find((t) => t.id === 'task-new')
      expect(newTask?.sorting).toBe(3)
    })

    it('returns state unchanged when afterTaskId is not found', () => {
      const state = makeState({
        tasks: [makeTask()],
      })
      const result = boardReducer(state, {
        type: 'CREATE_TASK_AFTER',
        id: 'task-new',
        afterTaskId: 'nonexistent',
      })
      expect(result).toBe(state)
    })
  })

  describe('RENAME_TASK', () => {
    it('updates the name of the matching task', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1', name: 'Old' })],
      })
      const result = boardReducer(state, {
        type: 'RENAME_TASK',
        taskId: 'task-1',
        name: 'New',
      })
      expect(result.tasks[0].name).toBe('New')
    })

    it('does not modify other tasks', () => {
      const state = makeState({
        tasks: [
          makeTask({ id: 'task-1', name: 'Keep' }),
          makeTask({ id: 'task-2', name: 'Also Keep' }),
        ],
      })
      const result = boardReducer(state, {
        type: 'RENAME_TASK',
        taskId: 'task-1',
        name: 'Changed',
      })
      expect(result.tasks[1].name).toBe('Also Keep')
    })
  })

  describe('DELETE_TASK', () => {
    it('removes the matching task', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2' })],
      })
      const result = boardReducer(state, {
        type: 'DELETE_TASK',
        taskId: 'task-1',
      })
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].id).toBe('task-2')
    })
  })

  describe('SET_TASK_DONE', () => {
    it('marks a task as done', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1', done: false })],
      })
      const result = boardReducer(state, {
        type: 'SET_TASK_DONE',
        taskId: 'task-1',
        done: true,
      })
      expect(result.tasks[0].done).toBe(true)
    })

    it('marks a task as not done', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1', done: true })],
      })
      const result = boardReducer(state, {
        type: 'SET_TASK_DONE',
        taskId: 'task-1',
        done: false,
      })
      expect(result.tasks[0].done).toBe(false)
    })
  })

  describe('MOVE_TASK', () => {
    it('updates the layerId and sorting of the task', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1', layerId: 'layer-1', sorting: 1 })],
      })
      const result = boardReducer(state, {
        type: 'MOVE_TASK',
        taskId: 'task-1',
        layerId: 'layer-2',
        sorting: 5,
      })
      expect(result.tasks[0].layerId).toBe('layer-2')
      expect(result.tasks[0].sorting).toBe(5)
    })
  })

  describe('RENAME_LAYER', () => {
    it('updates the name of the matching layer', () => {
      const state = makeState({
        layers: [makeLayer({ id: 'layer-1', name: null })],
      })
      const result = boardReducer(state, {
        type: 'RENAME_LAYER',
        layerId: 'layer-1',
        name: 'Design',
      })
      expect(result.layers[0].name).toBe('Design')
    })
  })

  describe('UNNAME_LAYER', () => {
    it('sets the layer name to null', () => {
      const state = makeState({
        layers: [makeLayer({ id: 'layer-1', name: 'Design' })],
      })
      const result = boardReducer(state, {
        type: 'UNNAME_LAYER',
        layerId: 'layer-1',
      })
      expect(result.layers[0].name).toBeNull()
    })
  })

  describe('SET_LAYER_STATUS', () => {
    it('sets layer status to done', () => {
      const state = makeState({
        layers: [makeLayer({ id: 'layer-1', status: null })],
      })
      const result = boardReducer(state, {
        type: 'SET_LAYER_STATUS',
        layerId: 'layer-1',
        status: 'done',
      })
      expect(result.layers[0].status).toBe('done')
    })

    it('clears layer status', () => {
      const state = makeState({
        layers: [makeLayer({ id: 'layer-1', status: 'done' })],
      })
      const result = boardReducer(state, {
        type: 'SET_LAYER_STATUS',
        layerId: 'layer-1',
        status: null,
      })
      expect(result.layers[0].status).toBeNull()
    })
  })

  describe('SPLIT_LAYER', () => {
    it('creates a new layer and moves tasks after the threshold', () => {
      const state = makeState({
        layers: [makeLayer({ id: 'layer-1', sliceId: 'slice-1', sorting: 1 })],
        tasks: [
          makeTask({ id: 'task-1', layerId: 'layer-1', sorting: 1 }),
          makeTask({ id: 'task-2', layerId: 'layer-1', sorting: 2 }),
          makeTask({ id: 'task-3', layerId: 'layer-1', sorting: 3 }),
        ],
      })
      const result = boardReducer(state, {
        type: 'SPLIT_LAYER',
        taskId: 'task-1',
        newLayerId: 'layer-2',
        currentLayerId: 'layer-1',
        sliceId: 'slice-1',
        taskSorting: 1,
        newLayerSorting: 2,
      })

      expect(result.layers).toHaveLength(2)
      const newLayer = result.layers.find((l) => l.id === 'layer-2')
      expect(newLayer).toEqual({
        id: 'layer-2',
        sliceId: 'slice-1',
        name: null,
        sorting: 2,
        status: null,
      })

      expect(result.tasks.find((t) => t.id === 'task-1')?.layerId).toBe(
        'layer-1'
      )
      expect(result.tasks.find((t) => t.id === 'task-2')?.layerId).toBe(
        'layer-2'
      )
      expect(result.tasks.find((t) => t.id === 'task-3')?.layerId).toBe(
        'layer-2'
      )
    })

    it('does not move tasks from other layers', () => {
      const state = makeState({
        layers: [
          makeLayer({ id: 'layer-1', sliceId: 'slice-1', sorting: 1 }),
          makeLayer({ id: 'layer-other', sliceId: 'slice-2', sorting: 1 }),
        ],
        tasks: [
          makeTask({ id: 'task-1', layerId: 'layer-1', sorting: 1 }),
          makeTask({ id: 'task-other', layerId: 'layer-other', sorting: 2 }),
        ],
      })
      const result = boardReducer(state, {
        type: 'SPLIT_LAYER',
        taskId: 'task-1',
        newLayerId: 'layer-2',
        currentLayerId: 'layer-1',
        sliceId: 'slice-1',
        taskSorting: 0,
        newLayerSorting: 2,
      })
      expect(result.tasks.find((t) => t.id === 'task-other')?.layerId).toBe(
        'layer-other'
      )
    })
  })

  describe('UNSPLIT_LAYER', () => {
    it('merges the next layer into the current one', () => {
      const state = makeState({
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
      const result = boardReducer(state, {
        type: 'UNSPLIT_LAYER',
        layerId: 'layer-1',
      })

      expect(result.layers).toHaveLength(1)
      expect(result.layers[0].id).toBe('layer-1')

      expect(result.tasks.every((t) => t.layerId === 'layer-1')).toBe(true)
      const task2 = result.tasks.find((t) => t.id === 'task-2')
      const task3 = result.tasks.find((t) => t.id === 'task-3')
      expect(task2?.sorting).toBe(2)
      expect(task3?.sorting).toBe(3)
    })

    it('returns state unchanged when layer is not found', () => {
      const state = makeState({
        layers: [makeLayer({ id: 'layer-1' })],
      })
      const result = boardReducer(state, {
        type: 'UNSPLIT_LAYER',
        layerId: 'nonexistent',
      })
      expect(result).toBe(state)
    })

    it('returns state unchanged when there is no next layer', () => {
      const state = makeState({
        layers: [makeLayer({ id: 'layer-1', sliceId: 'slice-1', sorting: 1 })],
      })
      const result = boardReducer(state, {
        type: 'UNSPLIT_LAYER',
        layerId: 'layer-1',
      })
      expect(result).toBe(state)
    })

    it('only merges the next layer in the same slice', () => {
      const state = makeState({
        layers: [
          makeLayer({ id: 'layer-1', sliceId: 'slice-1', sorting: 1 }),
          makeLayer({ id: 'layer-other', sliceId: 'slice-2', sorting: 2 }),
        ],
      })
      const result = boardReducer(state, {
        type: 'UNSPLIT_LAYER',
        layerId: 'layer-1',
      })
      expect(result).toBe(state)
    })
  })

  describe('SET_TASK_NOTES', () => {
    it('sets notes HTML on a task', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1', notesHtml: null })],
      })
      const result = boardReducer(state, {
        type: 'SET_TASK_NOTES',
        taskId: 'task-1',
        notesHtml: '<p>Some notes</p>',
      })
      expect(result.tasks[0].notesHtml).toBe('<p>Some notes</p>')
    })

    it('clears notes by setting to null', () => {
      const state = makeState({
        tasks: [makeTask({ id: 'task-1', notesHtml: '<p>Old</p>' })],
      })
      const result = boardReducer(state, {
        type: 'SET_TASK_NOTES',
        taskId: 'task-1',
        notesHtml: null,
      })
      expect(result.tasks[0].notesHtml).toBeNull()
    })
  })

  describe('RENAME_SLICE', () => {
    it('updates the name of the matching slice', () => {
      const state = makeState({
        slices: [makeSlice({ id: 'slice-1', name: null })],
      })
      const result = boardReducer(state, {
        type: 'RENAME_SLICE',
        sliceId: 'slice-1',
        name: 'Auth',
      })
      expect(result.slices[0].name).toBe('Auth')
    })
  })

  describe('UNNAME_SLICE', () => {
    it('sets the slice name to null', () => {
      const state = makeState({
        slices: [makeSlice({ id: 'slice-1', name: 'Auth' })],
      })
      const result = boardReducer(state, {
        type: 'UNNAME_SLICE',
        sliceId: 'slice-1',
      })
      expect(result.slices[0].name).toBeNull()
    })
  })

  describe('SORT_SLICES', () => {
    it('updates box numbers according to the mapping', () => {
      const state = makeState({
        slices: [
          makeSlice({ id: 'slice-1', boxNumber: 1 }),
          makeSlice({ id: 'slice-2', boxNumber: 2 }),
          makeSlice({ id: 'slice-3', boxNumber: 3 }),
        ],
      })
      const result = boardReducer(state, {
        type: 'SORT_SLICES',
        slices: [
          { id: 'slice-1', boxNumber: 3 },
          { id: 'slice-3', boxNumber: 1 },
        ],
      })
      expect(result.slices.find((s) => s.id === 'slice-1')?.boxNumber).toBe(3)
      expect(result.slices.find((s) => s.id === 'slice-2')?.boxNumber).toBe(2)
      expect(result.slices.find((s) => s.id === 'slice-3')?.boxNumber).toBe(1)
    })
  })

  describe('LOAD_STATE', () => {
    it('replaces the entire state', () => {
      const state = makeState()
      const newState = makeState({
        project: { id: 'new-project', name: 'Loaded' },
        slices: [makeSlice({ id: 'new-slice' })],
      })
      const result = boardReducer(state, {
        type: 'LOAD_STATE',
        state: newState,
      })
      expect(result).toBe(newState)
    })
  })
})
