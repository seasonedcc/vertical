import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { BoardState } from '~/state/types'
import { deserialize, deserializeEvents, serialize } from './format'
import { CURRENT_VERSION, migrate } from './migrations'

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
        status: null,
        statusReason: null,
        assignee: null,
        blockedBy: [],
        links: [],
        needsPickup: false,
      },
    ],
    ...overrides,
  }
}

describe('serialize', () => {
  it('produces valid JSON with the current version', () => {
    const state = makeState()
    const json = serialize(state)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(CURRENT_VERSION)
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

  it('normalizes missing status fields on older files', () => {
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
    expect(result.tasks[0]).toMatchObject({
      status: null,
      statusReason: null,
      assignee: null,
      blockedBy: [],
      links: [],
      needsPickup: false,
    })
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
          status: null,
          statusReason: null,
          assignee: null,
          blockedBy: [],
          links: [],
          needsPickup: false,
        },
      ],
    })
    const result = deserialize(json)
    expect(result.tasks[0].notesHtml).toBe('<p>Hello</p>')
  })

  it('refuses a file written by a newer Vertical', () => {
    const json = JSON.stringify({
      version: CURRENT_VERSION + 1,
      project: { id: 'p', name: 'P' },
      slices: [],
      layers: [],
      tasks: [],
    })
    expect(() => deserialize(json)).toThrow('Update with: itsvertical update')
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
          status: null,
          statusReason: null,
          assignee: null,
          blockedBy: [],
          links: [],
          needsPickup: false,
        },
        {
          id: 'task-2',
          projectId: 'project-1',
          layerId: 'layer-1',
          name: 'Without notes',
          sorting: 2,
          done: true,
          notesHtml: null,
          status: null,
          statusReason: null,
          assignee: null,
          blockedBy: [],
          links: [],
          needsPickup: false,
        },
      ],
    })
    const result = deserialize(serialize(state))
    expect(result).toEqual(state)
  })
})

describe('migrate', () => {
  it('upgrades a version 1 file without touching what it already had', () => {
    const migrated = migrate({
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
          done: true,
          notesHtml: '<p>Keep me</p>',
        },
      ],
    })
    expect(migrated.version).toBe(CURRENT_VERSION)
    expect(migrated.events).toEqual([])
    expect((migrated.tasks as unknown[])[0]).toEqual({
      id: 't1',
      projectId: 'p',
      layerId: 'l1',
      name: 'Task',
      sorting: 1,
      done: true,
      notesHtml: '<p>Keep me</p>',
      status: null,
      statusReason: null,
      assignee: null,
      blockedBy: [],
      links: [],
      needsPickup: false,
    })
  })

  it('leaves a current file as it is', () => {
    const file = { version: CURRENT_VERSION, tasks: [], events: [] }
    expect(migrate(file)).toBe(file)
  })

  it('refuses a version it does not know', () => {
    expect(() => migrate({ version: 0 })).toThrow('Unsupported file version: 0')
  })

  it.each(['sample.vertical', 'roadmap.vertical'])(
    'loads the version 1 file %s that ships with the repository',
    (name) => {
      const json = fs.readFileSync(path.resolve(name), 'utf-8')
      const original = JSON.parse(json)
      const state = deserialize(json)

      expect(original.version).toBe(1)
      expect(state.tasks).toHaveLength(original.tasks.length)
      expect(state.tasks.map((t) => [t.id, t.name, t.done])).toEqual(
        original.tasks.map((t: { id: string; name: string; done: boolean }) => [
          t.id,
          t.name,
          t.done,
        ])
      )
      expect(deserializeEvents(json)).toEqual([])
      expect(JSON.parse(serialize(state)).version).toBe(CURRENT_VERSION)
    }
  )
})
