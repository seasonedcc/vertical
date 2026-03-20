import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardState, Layer, Slice, Task } from '~/state/types'
import { showBoardGrid, showSummaryTable } from './board'

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

function makeNineSlices() {
  return Array.from({ length: 9 }, (_, i) => {
    const num = i + 1
    return makeSlice({
      id: `slice-${num}`,
      boxNumber: num,
      name: null,
    })
  })
}

function makeNineLayers() {
  return Array.from({ length: 9 }, (_, i) => {
    const num = i + 1
    return makeLayer({
      id: `layer-${num}`,
      sliceId: `slice-${num}`,
    })
  })
}

function stripAnsi(text: string) {
  return text.replace(new RegExp(`${'\x1b'}\\[[0-9;]*m`, 'g'), '')
}

let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  logSpy.mockRestore()
})

function getOutput() {
  return logSpy.mock.calls.map((c) => String(c[0] ?? '')).join('\n')
}

function getVisibleOutput() {
  return stripAnsi(getOutput())
}

describe('showBoardGrid', () => {
  it('outputs project name', () => {
    const state = makeState({
      slices: makeNineSlices(),
      layers: makeNineLayers(),
    })
    showBoardGrid(state)
    expect(getVisibleOutput()).toContain('Test Project')
  })

  it('shows grid with box borders', () => {
    const state = makeState({
      slices: makeNineSlices(),
      layers: makeNineLayers(),
    })
    showBoardGrid(state)
    const output = getVisibleOutput()
    expect(output).toContain('┌')
    expect(output).toContain('┬')
    expect(output).toContain('┐')
    expect(output).toContain('│')
    expect(output).toContain('└')
    expect(output).toContain('┴')
    expect(output).toContain('┘')
  })

  it('shows "(no tasks)" for empty slices', () => {
    const state = makeState({
      slices: makeNineSlices(),
      layers: makeNineLayers(),
    })
    showBoardGrid(state)
    expect(getVisibleOutput()).toContain('(no tasks)')
  })

  it('shows slice name when present', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Authentication' }
    const state = makeState({
      slices,
      layers: makeNineLayers(),
    })
    showBoardGrid(state)
    expect(getVisibleOutput()).toContain('Authentication')
  })

  it('shows done markers for done tasks and open markers for not-done tasks', () => {
    const state = makeState({
      slices: makeNineSlices(),
      layers: makeNineLayers(),
      tasks: [
        makeTask({ done: true, name: 'Done task' }),
        makeTask({ id: 'task-2', done: false, name: 'Open task', sorting: 2 }),
      ],
    })
    showBoardGrid(state)
    const output = getVisibleOutput()
    expect(output).toContain('● Done task')
    expect(output).toContain('○ Open task')
  })

  it('shows layer names when multiple layers exist', () => {
    const state = makeState({
      slices: makeNineSlices(),
      layers: [
        ...makeNineLayers(),
        makeLayer({
          id: 'layer-1b',
          sliceId: 'slice-1',
          name: 'Build',
          sorting: 2,
        }),
      ],
      tasks: [makeTask({ layerId: 'layer-1' })],
    })
    showBoardGrid(state)
    const output = getVisibleOutput()
    expect(output).toContain('Layer 1')
    expect(output).toContain('Build')
  })

  it('shows done status for done layers with multiple layers', () => {
    const state = makeState({
      slices: makeNineSlices(),
      layers: [
        ...makeNineLayers().map((l) =>
          l.id === 'layer-1'
            ? { ...l, name: 'Design', status: 'done' as const }
            : l
        ),
        makeLayer({
          id: 'layer-1b',
          sliceId: 'slice-1',
          name: 'Build',
          sorting: 2,
        }),
      ],
      tasks: [makeTask({ layerId: 'layer-1', done: true })],
    })
    showBoardGrid(state)
    expect(getVisibleOutput()).toContain('Design (done)')
  })

  it('shows progress line', () => {
    const state = makeState({
      slices: makeNineSlices(),
      layers: makeNineLayers(),
      tasks: [
        makeTask({ done: true }),
        makeTask({ id: 'task-2', done: false, sorting: 2 }),
        makeTask({ id: 'task-3', done: true, sorting: 3 }),
      ],
    })
    showBoardGrid(state)
    expect(getVisibleOutput()).toContain('2/3')
    expect(getVisibleOutput()).toContain('tasks done')
  })

  it('filters to single box when boxId is provided', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Auth' }
    slices[1] = { ...slices[1], name: 'Dashboard' }
    const state = makeState({
      slices,
      layers: makeNineLayers(),
      tasks: [
        makeTask({ layerId: 'layer-1', name: 'Auth task' }),
        makeTask({
          id: 'task-2',
          layerId: 'layer-2',
          name: 'Dash task',
          sorting: 1,
        }),
      ],
    })
    showBoardGrid(state, 'slice-2')
    const output = getVisibleOutput()
    expect(output).toContain('Dash task')
    expect(output).not.toContain('Auth task')
  })
})

describe('showSummaryTable', () => {
  it('outputs table headers', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Auth' }
    const state = makeState({
      slices,
      layers: makeNineLayers(),
    })
    showSummaryTable(state)
    const output = getVisibleOutput()
    expect(output).toContain('Scope')
    expect(output).toContain('Done')
    expect(output).toContain('Status')
  })

  it('shows named slices as rows with task counts', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Auth' }
    const state = makeState({
      slices,
      layers: makeNineLayers(),
      tasks: [
        makeTask({ done: true }),
        makeTask({ id: 'task-2', done: false, sorting: 2 }),
      ],
    })
    showSummaryTable(state)
    const output = getVisibleOutput()
    expect(output).toContain('Auth')
    expect(output).toContain('1/2')
  })

  it('shows "All done" for fully completed slices', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Auth' }
    const state = makeState({
      slices,
      layers: makeNineLayers(),
      tasks: [
        makeTask({ done: true }),
        makeTask({ id: 'task-2', done: true, sorting: 2 }),
      ],
    })
    showSummaryTable(state)
    expect(getVisibleOutput()).toContain('All done')
  })

  it('shows "No tasks yet" for slices with no tasks but a name', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Auth' }
    const state = makeState({
      slices,
      layers: makeNineLayers(),
    })
    showSummaryTable(state)
    expect(getVisibleOutput()).toContain('No tasks yet')
  })

  it('groups unnamed empty slices into single row', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Auth' }
    const state = makeState({
      slices,
      layers: makeNineLayers(),
    })
    showSummaryTable(state)
    const output = getVisibleOutput()
    expect(output).toContain('Boxes 2')
    expect(output).toContain('Unnamed & empty')
  })

  it('shows done layer names for multi-layer slices', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Auth' }
    const state = makeState({
      slices,
      layers: [
        ...makeNineLayers().map((l) =>
          l.id === 'layer-1'
            ? { ...l, name: 'Design', status: 'done' as const }
            : l
        ),
        makeLayer({
          id: 'layer-1b',
          sliceId: 'slice-1',
          name: 'Build',
          sorting: 2,
        }),
      ],
      tasks: [
        makeTask({ layerId: 'layer-1', done: true }),
        makeTask({
          id: 'task-2',
          layerId: 'layer-1b',
          done: false,
          sorting: 1,
        }),
      ],
    })
    showSummaryTable(state)
    const output = getVisibleOutput()
    expect(output).toContain('Design marked done')
  })

  it('shows open task count for multi-layer slices', () => {
    const slices = makeNineSlices()
    slices[0] = { ...slices[0], name: 'Auth' }
    const state = makeState({
      slices,
      layers: [
        ...makeNineLayers(),
        makeLayer({
          id: 'layer-1b',
          sliceId: 'slice-1',
          sorting: 2,
        }),
      ],
      tasks: [
        makeTask({ done: true }),
        makeTask({ id: 'task-2', done: false, sorting: 2 }),
        makeTask({
          id: 'task-3',
          layerId: 'layer-1b',
          done: false,
          sorting: 1,
        }),
      ],
    })
    showSummaryTable(state)
    expect(getVisibleOutput()).toContain('2 tasks still open')
  })

  it('does nothing when there are no slices', () => {
    const state = makeState()
    showSummaryTable(state)
    expect(logSpy).not.toHaveBeenCalled()
  })
})
