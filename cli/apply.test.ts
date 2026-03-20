import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serialize } from '~/file/format'
import type { BoardState, Layer, Slice, Task } from '~/state/types'
import {
  applyAction,
  fail,
  loadState,
  output,
  resolveFilePath,
  saveState,
} from './apply'

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
    slices: [makeSlice()],
    layers: [makeLayer()],
    tasks: [makeTask()],
    ...overrides,
  }
}

let tempDir: string
let tempFile: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'vertical-test-'))
  tempFile = join(tempDir, 'test.vertical')
  writeFileSync(tempFile, serialize(makeState()))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('resolveFilePath', () => {
  it('returns absolute path for existing file', () => {
    const result = resolveFilePath(tempFile)
    expect(result).toBe(tempFile)
  })

  it('calls process.exit when file does not exist', () => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => resolveFilePath('/nonexistent/file.vertical')).toThrow('exit')
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('loadState', () => {
  it('reads and deserializes a valid .vertical file', () => {
    const state = loadState(tempFile)
    expect(state.project.name).toBe('Test Project')
    expect(state.slices).toHaveLength(1)
    expect(state.layers).toHaveLength(1)
    expect(state.tasks).toHaveLength(1)
  })

  it('throws on invalid file content', () => {
    writeFileSync(tempFile, 'not valid json')
    expect(() => loadState(tempFile)).toThrow()
  })
})

describe('saveState', () => {
  it('serializes and writes state to file', () => {
    const state = makeState({ project: { id: 'p-2', name: 'Saved' } })
    saveState(tempFile, state)
    const loaded = loadState(tempFile)
    expect(loaded.project.name).toBe('Saved')
  })

  it('round-trips: saveState then loadState returns equivalent state', () => {
    const state = makeState({
      tasks: [makeTask({ notesHtml: '<p>hello</p>' })],
    })
    saveState(tempFile, state)
    const loaded = loadState(tempFile)
    expect(loaded).toEqual(state)
  })
})

describe('applyAction', () => {
  it('loads state, applies action, saves, and returns new state', () => {
    const result = applyAction(tempFile, {
      type: 'RENAME_PROJECT',
      name: 'Renamed',
    })
    expect(result.project.name).toBe('Renamed')
  })

  it('persists the change to disk', () => {
    applyAction(tempFile, { type: 'RENAME_PROJECT', name: 'Persisted' })
    const loaded = loadState(tempFile)
    expect(loaded.project.name).toBe('Persisted')
  })
})

describe('output', () => {
  it('logs JSON when json is true', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const state = makeState()
    output(state, true, 'ignored message')
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(() => JSON.parse(logged)).not.toThrow()
  })

  it('logs the message when json is false', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    output(makeState(), false, 'Done!')
    expect(logSpy).toHaveBeenCalledWith('Done!')
  })
})

describe('fail', () => {
  it('logs JSON error and exits when json is true', () => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    expect(() => fail('bad thing', true)).toThrow('exit')
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'bad thing' }))
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('logs plain error to stderr and exits when json is false', () => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => fail('bad thing')).toThrow('exit')
    expect(errorSpy).toHaveBeenCalledWith('Error: bad thing')
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
