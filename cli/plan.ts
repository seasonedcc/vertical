import type {
  BoardState,
  Layer,
  Task,
  TaskLink,
  TaskStatus,
} from '~/state/types'

type PlanTask = {
  name: string
  key?: string
  done?: boolean
  status?: TaskStatus
  reason?: string
  assignee?: string
  notesHtml?: string
  links?: TaskLink[]
  blockedBy?: string[]
}

type PlanLayer = {
  name?: string
  status?: 'done'
  tasks: PlanTask[]
}

type PlanBox = {
  box: number
  name?: string
  layers: PlanLayer[]
}

type Plan = { boxes: PlanBox[] }

const TASK_STATUSES = ['active', 'failed', 'blocked']

function parsePlan(json: string): Plan {
  const plan = JSON.parse(json) as Plan

  if (!plan || !Array.isArray(plan.boxes)) {
    throw new Error('Invalid plan: expected { "boxes": [...] }')
  }

  for (const box of plan.boxes) {
    if (!Number.isInteger(box.box) || box.box < 1 || box.box > 9) {
      throw new Error(`Invalid plan: box must be 1-9, got ${box.box}`)
    }
    if (!Array.isArray(box.layers) || box.layers.length === 0) {
      throw new Error(`Invalid plan: box ${box.box} needs at least one layer`)
    }
    for (const layer of box.layers) {
      if (!Array.isArray(layer.tasks)) {
        throw new Error(`Invalid plan: a layer in box ${box.box} has no tasks`)
      }
      if (layer.status !== undefined && layer.status !== 'done') {
        throw new Error(`Invalid plan: layer status must be "done"`)
      }
      for (const task of layer.tasks) {
        if (typeof task.name !== 'string' || task.name === '') {
          throw new Error(`Invalid plan: a task in box ${box.box} has no name`)
        }
        if (task.status !== undefined && !TASK_STATUSES.includes(task.status)) {
          throw new Error(`Invalid plan: unknown task status ${task.status}`)
        }
      }
    }
  }

  return plan
}

function applyPlan(state: BoardState, plan: Plan, createId: () => string) {
  const layers: Layer[] = [...state.layers]
  const tasks: Task[] = [...state.tasks]
  let slices = state.slices
  const idByKey = new Map<string, string>()
  const pendingBlockers: Array<{ taskId: string; keys: string[] }> = []
  const created: Array<{ id: string; name: string; key: string | null }> = []

  for (const planBox of plan.boxes) {
    const slice = slices.find((s) => s.boxNumber === planBox.box)
    if (!slice) throw new Error(`Box not found: ${planBox.box}`)

    const sliceLayers = layers.filter((l) => l.sliceId === slice.id)
    const hasTasks = tasks.some((t) =>
      sliceLayers.some((l) => l.id === t.layerId)
    )
    if (sliceLayers.length !== 1 || hasTasks) {
      throw new Error(`Box ${planBox.box} is not empty`)
    }

    if (planBox.name !== undefined) {
      const name = planBox.name
      slices = slices.map((s) => (s.id === slice.id ? { ...s, name } : s))
    }

    const firstLayer = sliceLayers[0]

    planBox.layers.forEach((planLayer, layerIndex) => {
      const layerId = layerIndex === 0 ? firstLayer.id : createId()
      const layer = {
        id: layerId,
        sliceId: slice.id,
        name: planLayer.name ?? null,
        sorting: firstLayer.sorting + layerIndex,
        status: planLayer.status ?? null,
      }

      if (layerIndex === 0) {
        layers[layers.indexOf(firstLayer)] = layer
      } else {
        layers.push(layer)
      }

      planLayer.tasks.forEach((planTask, taskIndex) => {
        const id = createId()
        if (planTask.key) {
          if (idByKey.has(planTask.key)) {
            throw new Error(`Invalid plan: duplicate task key ${planTask.key}`)
          }
          idByKey.set(planTask.key, id)
        }
        if (planTask.blockedBy?.length) {
          pendingBlockers.push({ taskId: id, keys: planTask.blockedBy })
        }
        const done = Boolean(planTask.done)
        tasks.push({
          id,
          projectId: state.project.id,
          layerId,
          name: planTask.name,
          sorting: taskIndex + 1,
          done,
          notesHtml: planTask.notesHtml ?? null,
          status: done ? null : (planTask.status ?? null),
          statusReason: done ? null : (planTask.reason ?? null),
          assignee: planTask.assignee ?? null,
          blockedBy: [],
          links: planTask.links ?? [],
          needsPickup: false,
        })
        created.push({ id, name: planTask.name, key: planTask.key ?? null })
      })
    })
  }

  for (const { taskId, keys } of pendingBlockers) {
    const blockedBy = keys.map((key) => {
      const id = idByKey.get(key)
      if (!id) throw new Error(`Invalid plan: unknown task key ${key}`)
      return id
    })
    const index = tasks.findIndex((t) => t.id === taskId)
    const task = tasks[index]
    if (task.done) continue
    tasks[index] = { ...task, status: 'blocked', blockedBy }
  }

  return { state: { ...state, slices, layers, tasks }, created }
}

export { applyPlan, parsePlan }
export type { Plan }
