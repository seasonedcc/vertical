import { describe, expect, it, vi } from 'vitest'
import type { Layer, Slice, Task } from '~/state/types'
import {
  type PendingTask,
  getLayer,
  getNextSorting,
  getTasks,
  makeDragSliceOverHandler,
  makeDragTaskOverHandler,
} from './drag-helpers'

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

function makePendingTask(overrides: Partial<PendingTask> = {}): PendingTask {
  return {
    id: 'task-1',
    projectId: 'project-1',
    layerId: 'layer-1',
    sliceId: 'slice-1',
    name: 'Task 1',
    sorting: 1,
    done: false,
    notesHtml: null,
    ...overrides,
  }
}

describe('getTasks', () => {
  it('returns tasks sorted by layerId then sorting', () => {
    const tasks = [
      makeTask({ id: 't-2', layerId: 'layer-2', sorting: 1 }),
      makeTask({ id: 't-1', layerId: 'layer-1', sorting: 2 }),
      makeTask({ id: 't-3', layerId: 'layer-1', sorting: 1 }),
    ]
    const result = getTasks({ tasksBeforeDrag: tasks, draggingTask: undefined })
    expect(result.map((t) => t.id)).toEqual(['t-3', 't-1', 't-2'])
  })

  it('merges draggingTask into result, replacing the original', () => {
    const tasks = [makeTask({ id: 't-1', sorting: 1, name: 'Original' })]
    const dragging = makePendingTask({
      id: 't-1',
      sorting: 5,
      name: 'Updated',
    })
    const result = getTasks({ tasksBeforeDrag: tasks, draggingTask: dragging })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Updated')
    expect(result[0].sorting).toBe(5)
  })

  it('works when draggingTask is undefined', () => {
    const tasks = [makeTask()]
    const result = getTasks({ tasksBeforeDrag: tasks, draggingTask: undefined })
    expect(result).toHaveLength(1)
  })
})

describe('getLayer', () => {
  it('returns the matching layer', () => {
    const layers = [makeLayer({ id: 'layer-1' }), makeLayer({ id: 'layer-2' })]
    expect(getLayer(layers, 'layer-2').id).toBe('layer-2')
  })

  it('throws when layer is not found', () => {
    expect(() => getLayer([], 'missing')).toThrow('Layer not found')
  })
})

describe('getNextSorting', () => {
  it('returns last task sorting + 1 when tasks exist', () => {
    const tasks = [
      makeTask({ sorting: 3 }),
      makeTask({ id: 't-2', sorting: 7 }),
    ]
    expect(getNextSorting(tasks)).toBe(8)
  })

  it('returns 1 when tasks array is empty', () => {
    expect(getNextSorting([])).toBe(1)
  })
})

describe('makeDragTaskOverHandler', () => {
  it('calls setDraggingTask with last layer and end sorting for slice drop', () => {
    const setDraggingTask = vi.fn()
    const dragging = makePendingTask({ id: 'drag-1', sorting: 1 })
    const layers = [
      makeLayer({ id: 'layer-1', sliceId: 'slice-1', sorting: 1 }),
      makeLayer({ id: 'layer-2', sliceId: 'slice-1', sorting: 2 }),
    ]
    const tasks = [makeTask({ id: 't-1', layerId: 'layer-2', sorting: 3 })]

    const handler = makeDragTaskOverHandler(
      dragging,
      setDraggingTask,
      layers,
      tasks
    )
    handler({ elementType: 'droppableSlice', sliceId: 'slice-1' })

    expect(setDraggingTask).toHaveBeenCalledOnce()
    const call = setDraggingTask.mock.calls[0][0]
    expect(call.layerId).toBe('layer-2')
    expect(call.sorting).toBe(4)
  })

  it('calls setDraggingTask with half of min sorting for layer start drop', () => {
    const setDraggingTask = vi.fn()
    const dragging = makePendingTask({ id: 'drag-1', sorting: 10 })
    const layers = [makeLayer({ id: 'layer-1', sliceId: 'slice-1' })]
    const tasks = [
      makeTask({ id: 't-1', layerId: 'layer-1', sorting: 4 }),
      makeTask({ id: 't-2', layerId: 'layer-1', sorting: 8 }),
    ]

    const handler = makeDragTaskOverHandler(
      dragging,
      setDraggingTask,
      layers,
      tasks
    )
    handler({ elementType: 'sortableLayer', layer: layers[0] })

    expect(setDraggingTask).toHaveBeenCalledOnce()
    expect(setDraggingTask.mock.calls[0][0].sorting).toBe(2)
  })

  it('calls setDraggingTask with midpoint sorting for task drop when dragging down', () => {
    const setDraggingTask = vi.fn()
    const dragging = makePendingTask({
      id: 'drag-1',
      layerId: 'layer-1',
      sorting: 1,
    })
    const layers = [makeLayer({ id: 'layer-1', sliceId: 'slice-1' })]
    const tasks = [
      makeTask({ id: 't-target', layerId: 'layer-1', sorting: 4 }),
      makeTask({ id: 't-next', layerId: 'layer-1', sorting: 8 }),
    ]

    const handler = makeDragTaskOverHandler(
      dragging,
      setDraggingTask,
      layers,
      tasks
    )
    handler({
      elementType: 'sortableTask',
      task: tasks[0],
    })

    expect(setDraggingTask).toHaveBeenCalledOnce()
    expect(setDraggingTask.mock.calls[0][0].sorting).toBe(6)
  })

  it('calls setDraggingTask with midpoint sorting for task drop when dragging up', () => {
    const setDraggingTask = vi.fn()
    const dragging = makePendingTask({
      id: 'drag-1',
      layerId: 'layer-1',
      sorting: 10,
    })
    const layers = [makeLayer({ id: 'layer-1', sliceId: 'slice-1' })]
    const tasks = [
      makeTask({ id: 't-prev', layerId: 'layer-1', sorting: 2 }),
      makeTask({ id: 't-target', layerId: 'layer-1', sorting: 6 }),
    ]

    const handler = makeDragTaskOverHandler(
      dragging,
      setDraggingTask,
      layers,
      tasks
    )
    handler({
      elementType: 'sortableTask',
      task: tasks[1],
    })

    expect(setDraggingTask).toHaveBeenCalledOnce()
    expect(setDraggingTask.mock.calls[0][0].sorting).toBe(4)
  })

  it('does not call setDraggingTask when draggingTask is undefined', () => {
    const setDraggingTask = vi.fn()
    const handler = makeDragTaskOverHandler(
      undefined,
      setDraggingTask,
      [makeLayer()],
      []
    )
    handler({ elementType: 'droppableSlice', sliceId: 'slice-1' })
    expect(setDraggingTask).not.toHaveBeenCalled()
  })

  it('does not call setDraggingTask when hovering over self', () => {
    const setDraggingTask = vi.fn()
    const dragging = makePendingTask({ id: 'drag-1' })
    const task = makeTask({ id: 'drag-1' })

    const handler = makeDragTaskOverHandler(
      dragging,
      setDraggingTask,
      [makeLayer()],
      [task]
    )
    handler({ elementType: 'sortableTask', task })
    expect(setDraggingTask).not.toHaveBeenCalled()
  })

  it('places at sorting 1 when dropping into empty layer via layer start', () => {
    const setDraggingTask = vi.fn()
    const dragging = makePendingTask({ id: 'drag-1', sorting: 5 })
    const layers = [makeLayer({ id: 'layer-1', sliceId: 'slice-1' })]

    const handler = makeDragTaskOverHandler(
      dragging,
      setDraggingTask,
      layers,
      []
    )
    handler({ elementType: 'sortableLayer', layer: layers[0] })

    expect(setDraggingTask).toHaveBeenCalledOnce()
    expect(setDraggingTask.mock.calls[0][0].sorting).toBe(1)
  })

  it('places at end when dropping on slice with existing tasks', () => {
    const setDraggingTask = vi.fn()
    const dragging = makePendingTask({
      id: 'drag-1',
      layerId: 'layer-other',
      sliceId: 'slice-other',
    })
    const layers = [makeLayer({ id: 'layer-1', sliceId: 'slice-1' })]
    const tasks = [
      makeTask({ id: 't-1', layerId: 'layer-1', sorting: 2 }),
      makeTask({ id: 't-2', layerId: 'layer-1', sorting: 5 }),
    ]

    const handler = makeDragTaskOverHandler(
      dragging,
      setDraggingTask,
      layers,
      tasks
    )
    handler({ elementType: 'droppableSlice', sliceId: 'slice-1' })

    expect(setDraggingTask).toHaveBeenCalledOnce()
    expect(setDraggingTask.mock.calls[0][0].sorting).toBe(6)
  })
})

describe('makeDragSliceOverHandler', () => {
  function makeNineSlices() {
    return Array.from({ length: 9 }, (_, i) => {
      const num = i + 1
      return makeSlice({ id: `slice-${num}`, boxNumber: num })
    })
  }

  it('sets overSliceId when hovering over a different slice', () => {
    const setOverSliceId = vi.fn()
    const slices = makeNineSlices()
    const handler = makeDragSliceOverHandler({
      slices,
      draggingSlice: slices[0],
      overSliceId: undefined,
      setOverSliceId,
    })
    handler({ elementType: 'droppableSlice', sliceId: 'slice-5' })
    expect(setOverSliceId).toHaveBeenCalledWith('slice-5')
  })

  it('does nothing when draggingSlice is undefined', () => {
    const setOverSliceId = vi.fn()
    const handler = makeDragSliceOverHandler({
      slices: makeNineSlices(),
      draggingSlice: undefined,
      overSliceId: undefined,
      setOverSliceId,
    })
    handler({ elementType: 'droppableSlice', sliceId: 'slice-5' })
    expect(setOverSliceId).not.toHaveBeenCalled()
  })

  it('does nothing when element type is not droppableSlice', () => {
    const setOverSliceId = vi.fn()
    const slices = makeNineSlices()
    const handler = makeDragSliceOverHandler({
      slices,
      draggingSlice: slices[0],
      overSliceId: undefined,
      setOverSliceId,
    })
    handler({
      elementType: 'sortableTask',
      task: makeTask(),
    })
    expect(setOverSliceId).not.toHaveBeenCalled()
  })

  it('does nothing when hovering over the dragging slice itself', () => {
    const setOverSliceId = vi.fn()
    const slices = makeNineSlices()
    const handler = makeDragSliceOverHandler({
      slices,
      draggingSlice: slices[0],
      overSliceId: undefined,
      setOverSliceId,
    })
    handler({ elementType: 'droppableSlice', sliceId: 'slice-1' })
    expect(setOverSliceId).not.toHaveBeenCalled()
  })

  it('advances to next slice when re-hovering the same overSliceId', () => {
    const setOverSliceId = vi.fn()
    const slices = makeNineSlices()
    const handler = makeDragSliceOverHandler({
      slices,
      draggingSlice: slices[0],
      overSliceId: 'slice-2',
      setOverSliceId,
    })
    handler({ elementType: 'droppableSlice', sliceId: 'slice-2' })
    expect(setOverSliceId).toHaveBeenCalledWith('slice-3')
  })
})
