import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardState, Layer, Slice, Task } from '~/state/types'
import { showBoard, showBoardJson } from './show'

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

describe('showBoard', () => {
  it('prints project name and id', () => {
    const state = makeState()
    showBoard(state)
    expect(getOutput()).toContain('Project: Test Project (id: project-1)')
  })

  it('prints box number and slice name for each slice', () => {
    const state = makeState({
      slices: [makeSlice({ name: 'Auth' })],
      layers: [makeLayer()],
    })
    showBoard(state)
    expect(getOutput()).toContain('Box 1: Auth (id: slice-1)')
  })

  it('prints "(untitled)" for unnamed slices', () => {
    const state = makeState({
      slices: [makeSlice({ name: null })],
      layers: [makeLayer()],
    })
    showBoard(state)
    expect(getOutput()).toContain('Box 1: (untitled) (id: slice-1)')
  })

  it('prints "[x]" for done tasks and "[ ]" for not-done', () => {
    const state = makeState({
      slices: [makeSlice()],
      layers: [makeLayer()],
      tasks: [
        makeTask({ done: true, name: 'Done task' }),
        makeTask({ id: 'task-2', done: false, name: 'Open task', sorting: 2 }),
      ],
    })
    showBoard(state)
    const output = getOutput()
    expect(output).toContain('[x] Done task')
    expect(output).toContain('[ ] Open task')
  })

  it('prints "[notes]" tag for tasks with notesHtml', () => {
    const state = makeState({
      slices: [makeSlice()],
      layers: [makeLayer()],
      tasks: [makeTask({ notesHtml: '<p>Some notes</p>' })],
    })
    showBoard(state)
    expect(getOutput()).toContain('[notes]')
  })

  it('prints "(no tasks)" for empty layers', () => {
    const state = makeState({
      slices: [makeSlice()],
      layers: [makeLayer()],
    })
    showBoard(state)
    expect(getOutput()).toContain('(no tasks)')
  })

  it('prints layer name when slice has multiple layers', () => {
    const state = makeState({
      slices: [makeSlice()],
      layers: [
        makeLayer({ name: 'Design' }),
        makeLayer({ id: 'layer-2', name: 'Build', sorting: 2 }),
      ],
    })
    showBoard(state)
    const output = getOutput()
    expect(output).toContain('Layer: Design')
    expect(output).toContain('Layer: Build')
  })

  it('prints "[done]" for done layers', () => {
    const state = makeState({
      slices: [makeSlice()],
      layers: [
        makeLayer({ name: 'Design', status: 'done' }),
        makeLayer({ id: 'layer-2', name: 'Build', sorting: 2 }),
      ],
    })
    showBoard(state)
    expect(getOutput()).toContain('[done]')
  })

  it('filters to single box when boxId is provided', () => {
    const state = makeState({
      slices: [
        makeSlice({ id: 'slice-1', boxNumber: 1, name: 'Auth' }),
        makeSlice({ id: 'slice-2', boxNumber: 2, name: 'Dashboard' }),
      ],
      layers: [
        makeLayer({ sliceId: 'slice-1' }),
        makeLayer({ id: 'layer-2', sliceId: 'slice-2' }),
      ],
    })
    showBoard(state, 'slice-2')
    const output = getOutput()
    expect(output).not.toContain('Auth')
    expect(output).toContain('Dashboard')
  })
})

describe('showBoardJson', () => {
  it('outputs valid parseable JSON', () => {
    const state = makeState({
      slices: [makeSlice()],
      layers: [makeLayer()],
    })
    showBoardJson(state)
    const output = getOutput()
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('outputs slices sorted by boxNumber', () => {
    const state = makeState({
      slices: [
        makeSlice({ id: 'slice-3', boxNumber: 3 }),
        makeSlice({ id: 'slice-1', boxNumber: 1 }),
        makeSlice({ id: 'slice-2', boxNumber: 2 }),
      ],
    })
    showBoardJson(state)
    const parsed = JSON.parse(getOutput())
    expect(parsed.slices.map((s: Slice) => s.boxNumber)).toEqual([1, 2, 3])
  })
})
