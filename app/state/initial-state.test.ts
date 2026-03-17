import { describe, expect, it } from 'vitest'
import { createBlankProject } from './initial-state'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('createBlankProject', () => {
  it('creates a project with the given name', () => {
    const state = createBlankProject('My Project')
    expect(state.project.name).toBe('My Project')
  })

  it('creates a project with a valid UUID', () => {
    const state = createBlankProject('Test')
    expect(state.project.id).toMatch(UUID_REGEX)
  })

  it('creates exactly 9 slices', () => {
    const state = createBlankProject('Test')
    expect(state.slices).toHaveLength(9)
  })

  it('creates slices with box numbers 1 through 9', () => {
    const state = createBlankProject('Test')
    const boxNumbers = state.slices.map((s) => s.boxNumber).sort()
    expect(boxNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('creates slices with the project id', () => {
    const state = createBlankProject('Test')
    for (const slice of state.slices) {
      expect(slice.projectId).toBe(state.project.id)
    }
  })

  it('creates slices with null names', () => {
    const state = createBlankProject('Test')
    for (const slice of state.slices) {
      expect(slice.name).toBeNull()
    }
  })

  it('creates exactly 9 layers', () => {
    const state = createBlankProject('Test')
    expect(state.layers).toHaveLength(9)
  })

  it('creates one layer per slice', () => {
    const state = createBlankProject('Test')
    const sliceIds = new Set(state.slices.map((s) => s.id))
    const layerSliceIds = new Set(state.layers.map((l) => l.sliceId))
    expect(layerSliceIds).toEqual(sliceIds)
  })

  it('creates layers with sorting 1, null name, and null status', () => {
    const state = createBlankProject('Test')
    for (const layer of state.layers) {
      expect(layer.sorting).toBe(1)
      expect(layer.name).toBeNull()
      expect(layer.status).toBeNull()
    }
  })

  it('creates an empty tasks array', () => {
    const state = createBlankProject('Test')
    expect(state.tasks).toEqual([])
  })

  it('creates unique IDs across all entities', () => {
    const state = createBlankProject('Test')
    const allIds = [
      state.project.id,
      ...state.slices.map((s) => s.id),
      ...state.layers.map((l) => l.id),
    ]
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(allIds.length)
  })
})
