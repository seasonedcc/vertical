import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLocalAdapter } from './local.js'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vertical-local-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('createLocalAdapter', () => {
  it('creates a board and lists it by its project name', async () => {
    const adapter = createLocalAdapter(dir)
    const created = await adapter.createBoard('My Project')

    expect(created.id).toBe('my-project.vertical')
    expect(fs.existsSync(path.join(dir, 'my-project.vertical'))).toBe(true)

    const boards = await adapter.listBoards()
    expect(boards).toEqual([{ id: 'my-project.vertical', name: 'My Project' }])
  })

  it('disambiguates board ids when the slug collides', async () => {
    const adapter = createLocalAdapter(dir)
    const first = await adapter.createBoard('Demo')
    const second = await adapter.createBoard('Demo')

    expect(first.id).toBe('demo.vertical')
    expect(second.id).toBe('demo-2.vertical')
  })

  it('finds boards in nested directories', async () => {
    const adapter = createLocalAdapter(dir)
    await adapter.createBoard('Root Board')
    const nested = await adapter.createBoard('Nested Board')
    fs.mkdirSync(path.join(dir, 'team'), { recursive: true })
    fs.renameSync(
      path.join(dir, nested.id),
      path.join(dir, 'team', 'nested.vertical')
    )

    const ids = (await adapter.listBoards()).map((b) => b.id)
    expect(ids).toContain('root-board.vertical')
    expect(ids).toContain('team/nested.vertical')
  })

  it('loads a board with a stable revision', async () => {
    const adapter = createLocalAdapter(dir)
    const { id } = await adapter.createBoard('Demo')

    const first = await adapter.loadBoard(id)
    const second = await adapter.loadBoard(id)
    expect(first.revision).toBe(second.revision)
    expect(first.state.project.name).toBe('Demo')
  })

  it('applies an action and persists it, changing the revision', async () => {
    const adapter = createLocalAdapter(dir)
    const { id } = await adapter.createBoard('Demo')
    const { state, revision } = await adapter.loadBoard(id)
    const layerId = state.layers[0].id

    const outcome = await adapter.applyAction(
      id,
      { type: 'CREATE_TASK', id: 'task-a', layerId, name: 'A', sorting: 1 },
      revision
    )

    expect(outcome.status).toBe('applied')
    expect(outcome.revision).not.toBe(revision)

    const reloaded = await adapter.loadBoard(id)
    expect(reloaded.state.tasks.map((t) => t.id)).toEqual(['task-a'])
  })

  it('lands two unrelated edits made against the same base revision', async () => {
    const adapter = createLocalAdapter(dir)
    const { id } = await adapter.createBoard('Demo')
    const { state, revision } = await adapter.loadBoard(id)

    const first = await adapter.applyAction(
      id,
      {
        type: 'CREATE_TASK',
        id: 'task-a',
        layerId: state.layers[0].id,
        name: 'A',
        sorting: 1,
      },
      revision
    )
    const second = await adapter.applyAction(
      id,
      {
        type: 'CREATE_TASK',
        id: 'task-b',
        layerId: state.layers[1].id,
        name: 'B',
        sorting: 1,
      },
      revision
    )

    expect(first.status).toBe('applied')
    expect(second.status).toBe('applied')

    const reloaded = await adapter.loadBoard(id)
    expect(reloaded.state.tasks.map((t) => t.id).sort()).toEqual([
      'task-a',
      'task-b',
    ])
  })

  it('rejects a conflicting edit to the same entity', async () => {
    const adapter = createLocalAdapter(dir)
    const { id } = await adapter.createBoard('Demo')
    const seeded = await adapter.loadBoard(id)
    await adapter.applyAction(
      id,
      {
        type: 'CREATE_TASK',
        id: 'task-x',
        layerId: seeded.state.layers[0].id,
        name: 'X',
        sorting: 1,
      },
      seeded.revision
    )

    const base = await adapter.loadBoard(id)
    await adapter.applyAction(
      id,
      { type: 'RENAME_TASK', taskId: 'task-x', name: 'First' },
      base.revision
    )
    const conflicting = await adapter.applyAction(
      id,
      { type: 'RENAME_TASK', taskId: 'task-x', name: 'Second' },
      base.revision
    )

    expect(conflicting.status).toBe('rejected')

    const final = await adapter.loadBoard(id)
    expect(final.state.tasks.find((t) => t.id === 'task-x')?.name).toBe('First')
  })

  it('renames the project without moving the file', async () => {
    const adapter = createLocalAdapter(dir)
    const { id } = await adapter.createBoard('Old Name')

    const renamed = await adapter.renameBoard(id, 'New Name')
    expect(renamed).toEqual({ id, name: 'New Name' })
    expect(fs.existsSync(path.join(dir, id))).toBe(true)

    const reloaded = await adapter.loadBoard(id)
    expect(reloaded.state.project.name).toBe('New Name')
  })

  it('deletes a board', async () => {
    const adapter = createLocalAdapter(dir)
    const { id } = await adapter.createBoard('Demo')

    await adapter.deleteBoard(id)
    expect(fs.existsSync(path.join(dir, id))).toBe(false)
    expect(await adapter.listBoards()).toEqual([])
  })

  it('rejects board ids that escape the root directory', async () => {
    const adapter = createLocalAdapter(dir)
    await expect(adapter.loadBoard('../escape.vertical')).rejects.toThrow(
      'Invalid board id'
    )
  })
})
