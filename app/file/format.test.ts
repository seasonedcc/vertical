import { describe, expect, it } from 'vitest'
import type { BoardState } from '~/state/types'
import { deserialize, serialize } from './format'

function makeState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    project: { id: 'project-1', name: 'Test' },
    slices: [
      { id: 'slice-1', projectId: 'project-1', boxNumber: 1, name: null },
    ],
    layers: [
      {
        id: 'layer-1',
        sliceId: 'slice-1',
        name: null,
        sorting: 1,
        status: null,
      },
    ],
    tasks: [
      {
        id: 'task-1',
        projectId: 'project-1',
        layerId: 'layer-1',
        name: 'Task 1',
        sorting: 1,
        done: false,
        notesHtml: null,
      },
    ],
    ...overrides,
  }
}

describe('serialize', () => {
  it('produces valid JSON with version 1', () => {
    const state = makeState()
    const json = serialize(state)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
  })

  it('includes all top-level keys', () => {
    const state = makeState()
    const parsed = JSON.parse(serialize(state))
    expect(parsed).toHaveProperty('project')
    expect(parsed).toHaveProperty('slices')
    expect(parsed).toHaveProperty('layers')
    expect(parsed).toHaveProperty('tasks')
  })

  it('produces pretty-printed JSON', () => {
    const state = makeState()
    const json = serialize(state)
    expect(json).toContain('\n')
    expect(json).toContain('  ')
  })
})

describe('deserialize', () => {
  it('parses valid JSON into BoardState', () => {
    const state = makeState()
    const json = serialize(state)
    const result = deserialize(json)
    expect(result.project).toEqual(state.project)
    expect(result.slices).toEqual(state.slices)
    expect(result.layers).toEqual(state.layers)
  })

  it('normalizes missing notesHtml to null', () => {
    const json = JSON.stringify({
      version: 1,
      project: { id: 'p', name: 'P' },
      slices: [],
      layers: [],
      tasks: [
        {
          id: 't1',
          projectId: 'p',
          layerId: 'l1',
          name: 'Task',
          sorting: 1,
          done: false,
        },
      ],
    })
    const result = deserialize(json)
    expect(result.tasks[0].notesHtml).toBeNull()
  })

  it('preserves notesHtml when present', () => {
    const json = JSON.stringify({
      version: 1,
      project: { id: 'p', name: 'P' },
      slices: [],
      layers: [],
      tasks: [
        {
          id: 't1',
          projectId: 'p',
          layerId: 'l1',
          name: 'Task',
          sorting: 1,
          done: false,
          notesHtml: '<p>Hello</p>',
        },
      ],
    })
    const result = deserialize(json)
    expect(result.tasks[0].notesHtml).toBe('<p>Hello</p>')
  })

  it('throws on wrong version', () => {
    const json = JSON.stringify({
      version: 2,
      project: { id: 'p', name: 'P' },
      slices: [],
      layers: [],
      tasks: [],
    })
    expect(() => deserialize(json)).toThrow('Unsupported file version: 2')
  })

  it('throws on missing required fields', () => {
    const json = JSON.stringify({ version: 1, project: { id: 'p', name: 'P' } })
    expect(() => deserialize(json)).toThrow('missing required fields')
  })

  it('throws on invalid JSON', () => {
    expect(() => deserialize('not json')).toThrow()
  })
})

describe('round-trip', () => {
  it('preserves state through serialize then deserialize', () => {
    const state = makeState()
    const result = deserialize(serialize(state))
    expect(result).toEqual(state)
  })

  it('preserves tasks with notesHtml values', () => {
    const state = makeState({
      tasks: [
        {
          id: 'task-1',
          projectId: 'project-1',
          layerId: 'layer-1',
          name: 'With notes',
          sorting: 1,
          done: false,
          notesHtml: '<p>Notes</p>',
        },
        {
          id: 'task-2',
          projectId: 'project-1',
          layerId: 'layer-1',
          name: 'Without notes',
          sorting: 2,
          done: true,
          notesHtml: null,
        },
      ],
    })
    const result = deserialize(serialize(state))
    expect(result).toEqual(state)
  })
})
