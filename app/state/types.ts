type Project = {
  id: string
  name: string
}

type Slice = {
  id: string
  projectId: string
  boxNumber: number
  name: string | null
}

type Layer = {
  id: string
  sliceId: string
  name: string | null
  sorting: number
  status: 'done' | null
}

type Task = {
  id: string
  projectId: string
  layerId: string
  name: string
  sorting: number
  done: boolean
  notesHtml: string | null
}

type BoardState = {
  project: Project
  slices: Slice[]
  layers: Layer[]
  tasks: Task[]
}

export type { BoardState, Layer, Project, Slice, Task }
