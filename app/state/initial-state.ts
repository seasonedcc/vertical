import type { BoardState } from './types'

function createBlankProject(name: string): BoardState {
  const projectId = crypto.randomUUID()

  const slices = Array.from({ length: 9 }, (_, i) => ({
    id: crypto.randomUUID(),
    projectId,
    boxNumber: i + 1,
    name: null,
  }))

  const layers = slices.map((slice) => ({
    id: crypto.randomUUID(),
    sliceId: slice.id,
    name: null,
    sorting: 1,
    status: null as 'done' | null,
  }))

  return {
    project: { id: projectId, name },
    slices,
    layers,
    tasks: [],
  }
}

export { createBlankProject }
