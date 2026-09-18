import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { serialize } from '~/file/format'
import type { BoardAction } from '~/state/actions'
import { createBlankProject } from '~/state/initial-state'
import { boardReducer } from '~/state/reducer'
import type { BoardState, Task } from '~/state/types'
import { applyAction, loadEvents, loadState, withFileLock } from './apply'
import { describeAction } from './events'
import { flagBrowserEdits, listInbox } from './inbox'
import { applyPlan, parsePlan } from './plan'
import { summarizeBoard } from './summary'
import { validateBoard } from './validate'

function sequentialIds() {
  let next = 0
  return () => `id-${++next}`
}

function withTask(state: BoardState, overrides: Partial<Task>): BoardState {
  return {
    ...state,
    tasks: [
      ...state.tasks,
      {
        id: 'task-1',
        projectId: state.project.id,
        layerId: state.layers[0].id,
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
        ...overrides,
      },
    ],
  }
}

const plan = {
  boxes: [
    {
      box: 1,
      name: 'Export endpoint',
      layers: [
        {
          name: 'Build',
          status: 'done' as const,
          tasks: [{ name: 'Query', key: 'query', done: true }],
        },
        {
          name: 'Verify',
          tasks: [
            { name: 'Spec', key: 'spec', status: 'active' as const },
            { name: 'Walkthrough', blockedBy: ['spec'] },
          ],
        },
      ],
    },
  ],
}

describe('applyPlan', () => {
  it('names the box, creates layers and tasks, and resolves blockers', () => {
    const blank = createBlankProject('Test')
    const { state, created } = applyPlan(blank, plan, sequentialIds())
    const slice = state.slices.find((s) => s.boxNumber === 1)
    const layers = state.layers.filter((l) => l.sliceId === slice?.id)
    const walkthrough = state.tasks.find((t) => t.name === 'Walkthrough')
    const spec = state.tasks.find((t) => t.name === 'Spec')

    expect(slice?.name).toBe('Export endpoint')
    expect(layers.map((l) => l.name)).toEqual(['Build', 'Verify'])
    expect(layers[0].status).toBe('done')
    expect(created).toHaveLength(3)
    expect(walkthrough).toMatchObject({
      status: 'blocked',
      blockedBy: [spec?.id],
    })
  })

  it('refuses a box that already has tasks', () => {
    const blank = createBlankProject('Test')
    const { state } = applyPlan(blank, plan, sequentialIds())
    expect(() => applyPlan(state, plan, sequentialIds())).toThrow(
      'Box 1 is not empty'
    )
  })

  it('rejects an unknown blocker key', () => {
    const blank = createBlankProject('Test')
    const broken = {
      boxes: [
        {
          box: 2,
          layers: [{ tasks: [{ name: 'A', blockedBy: ['missing'] }] }],
        },
      ],
    }
    expect(() => applyPlan(blank, broken, sequentialIds())).toThrow(
      'unknown task key missing'
    )
  })
})

describe('parsePlan', () => {
  it('rejects a box number outside the grid', () => {
    const json = JSON.stringify({ boxes: [{ box: 10, layers: [] }] })
    expect(() => parsePlan(json)).toThrow('box must be 1-9')
  })

  it('rejects an unknown task status', () => {
    const json = JSON.stringify({
      boxes: [
        { box: 1, layers: [{ tasks: [{ name: 'A', status: 'paused' }] }] },
      ],
    })
    expect(() => parsePlan(json)).toThrow('unknown task status paused')
  })
})

describe('validateBoard', () => {
  it('accepts a consistent board', () => {
    const { state } = applyPlan(
      createBlankProject('Test'),
      plan,
      sequentialIds()
    )
    expect(validateBoard(state)).toEqual([])
  })

  it('reports a failure without a reason', () => {
    const state = withTask(createBlankProject('Test'), { status: 'failed' })
    expect(validateBoard(state)[0]).toContain('failed without a reason')
  })

  it('reports a missing blocker and a done layer with open tasks', () => {
    const blank = createBlankProject('Test')
    const state = withTask(
      {
        ...blank,
        layers: blank.layers.map((l, index) =>
          index === 0 ? { ...l, status: 'done' as const } : l
        ),
      },
      { status: 'blocked', blockedBy: ['gone'] }
    )
    const problems = validateBoard(state).join('\n')
    expect(problems).toContain('blocked by a missing task: gone')
    expect(problems).toContain('is marked done with 1 open task')
  })

  it('reports a blocking cycle once', () => {
    const blank = createBlankProject('Test')
    const state = withTask(
      withTask(blank, {
        id: 'task-a',
        status: 'blocked',
        blockedBy: ['task-b'],
      }),
      { id: 'task-b', status: 'blocked', blockedBy: ['task-a'] }
    )
    const cycles = validateBoard(state).filter((p) =>
      p.startsWith('Blocking cycle')
    )
    expect(cycles).toHaveLength(1)
  })
})

describe('summarizeBoard', () => {
  it('counts statuses per box and lists what needs attention', () => {
    const { state } = applyPlan(
      createBlankProject('Test'),
      plan,
      sequentialIds()
    )
    const summary = summarizeBoard(state)
    expect(summary).toMatchObject({ total: 3, done: 1, active: 1, blocked: 1 })
    expect(summary.boxes).toHaveLength(1)
    expect(summary.boxes[0].layers.map((l) => l.done)).toEqual([1, 0])
    expect(summary.attention.map((a) => a.name)).toEqual(['Walkthrough'])
  })
})

describe('flagBrowserEdits and listInbox', () => {
  it('flags tasks touched by browser actions', () => {
    const state = withTask(createBlankProject('Test'), {})
    const flagged = flagBrowserEdits(state, [
      { type: 'RENAME_TASK', taskId: 'task-1', name: 'Renamed' },
    ])
    expect(flagged.tasks[0].needsPickup).toBe(true)
    expect(listInbox(flagged).map((item) => item.id)).toEqual(['task-1'])
  })

  it('ignores actions that do not edit a task', () => {
    const state = withTask(createBlankProject('Test'), {})
    const result = flagBrowserEdits(state, [
      { type: 'RENAME_PROJECT', name: 'Renamed' },
    ])
    expect(result).toBe(state)
  })
})

describe('file writes', () => {
  let directory: string
  let filePath: string

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vertical-'))
    filePath = path.join(directory, 'board.vertical')
    fs.writeFileSync(filePath, serialize(createBlankProject('Test')))
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('leaves no lock or temporary file behind', () => {
    applyAction(filePath, { type: 'RENAME_PROJECT', name: 'Renamed' })
    expect(loadState(filePath).project.name).toBe('Renamed')
    expect(fs.readdirSync(directory)).toEqual(['board.vertical'])
  })

  it('releases the lock when the update throws', () => {
    expect(() =>
      withFileLock(filePath, () => {
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(fs.existsSync(`${filePath}.lock`)).toBe(false)
  })

  it('takes over a stale lock', () => {
    const lockPath = `${filePath}.lock`
    fs.writeFileSync(lockPath, '')
    const old = new Date(Date.now() - 60000)
    fs.utimesSync(lockPath, old, old)
    applyAction(filePath, { type: 'RENAME_PROJECT', name: 'Renamed' })
    expect(loadState(filePath).project.name).toBe('Renamed')
  })
})

describe('event log', () => {
  let directory: string
  let filePath: string

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vertical-'))
    filePath = path.join(directory, 'board.vertical')
    fs.writeFileSync(filePath, serialize(createBlankProject('Test')))
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('appends one event per change and keeps earlier ones', () => {
    const layerId = loadState(filePath).layers[0].id
    applyAction(filePath, {
      type: 'CREATE_TASK',
      id: 'task-1',
      layerId,
      name: 'Query',
      sorting: 1,
    })
    applyAction(filePath, {
      type: 'SET_TASK_DONE',
      taskId: 'task-1',
      done: true,
    })

    const events = loadEvents(filePath)
    expect(events.map((event) => event.summary)).toEqual([
      'Added "Query" to Box 1',
      'Marked "Query" done',
    ])
    expect(events[0]).toMatchObject({ actor: 'cli', taskId: 'task-1' })
  })

  it('records nothing when the change is a no-op', () => {
    applyAction(filePath, { type: 'SET_TASK_DONE', taskId: 'gone', done: true })
    expect(loadEvents(filePath)).toEqual([])
  })

  it('keeps events out of the board state', () => {
    applyAction(filePath, { type: 'RENAME_PROJECT', name: 'Renamed' })
    expect(Object.keys(loadState(filePath))).toEqual([
      'project',
      'slices',
      'layers',
      'tasks',
    ])
  })
})

describe('describeAction', () => {
  it('reports tasks released when their blocker is done', () => {
    const before = withTask(
      withTask(createBlankProject('Test'), { id: 'task-a', name: 'Spec' }),
      {
        id: 'task-b',
        name: 'Walkthrough',
        status: 'blocked',
        blockedBy: ['task-a'],
      }
    )
    const action = {
      type: 'SET_TASK_DONE',
      taskId: 'task-a',
      done: true,
    } as const
    const after = boardReducer(before, action)
    expect(
      describeAction(before, after, action).map((event) => event.summary)
    ).toEqual(['Marked "Spec" done', 'Unblocked "Walkthrough"'])
  })

  it('describes a failure with its reason', () => {
    const before = withTask(createBlankProject('Test'), { name: 'Review' })
    const action: BoardAction = {
      type: 'SET_TASK_STATUS',
      taskId: 'task-1',
      status: 'failed',
      reason: 'gates red',
      assignee: null,
      blockedBy: [],
    }
    const after = boardReducer(before, action)
    expect(describeAction(before, after, action)[0].summary).toBe(
      '"Review" failed: gates red'
    )
  })
})
