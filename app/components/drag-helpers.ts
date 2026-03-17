import { sortBy } from '~/lib/utils'
import type { Layer, Slice, Task } from '~/state/types'

type PendingTask = Task & { sliceId: string }

type OverSliceData = {
  elementType: 'droppableSlice'
  sliceId: string
}

type OverLayerData = {
  elementType: 'sortableLayer'
  layer: Layer
}

type OverTaskData = {
  elementType: 'sortableTask'
  task: Task
}

type OverData = OverSliceData | OverLayerData | OverTaskData

type ActiveSliceData = {
  elementType: 'draggableSlice'
  slice: Slice
}

type ActiveTaskData = {
  elementType: 'sortableTask'
  task: Task
}

type ActiveData = ActiveSliceData | ActiveTaskData

function getTasks({
  tasksBeforeDrag,
  draggingTask,
}: {
  tasksBeforeDrag: Task[]
  draggingTask: PendingTask | undefined
}) {
  const tasksById = new Map(tasksBeforeDrag.map((task) => [task.id, task]))

  if (draggingTask) {
    tasksById.set(draggingTask.id, draggingTask)
  }

  return sortBy(Array.from(tasksById.values()), ['layerId', 'sorting'])
}

function getLayer(layers: Layer[], layerId: string) {
  const layer = layers.find(({ id }) => id === layerId)
  if (!layer) {
    throw new Error('Layer not found')
  }
  return layer
}

function getLastLayer(layers: Layer[], sliceId: string) {
  const sliceLayers = layers.filter((layer) => layer.sliceId === sliceId)
  const layer = sliceLayers[sliceLayers.length - 1]
  if (!layer) {
    throw new Error('Last layer not found')
  }
  return layer
}

function calculateTaskSortingForSlice(
  tasks: Task[],
  layerId: string,
  draggingTaskId: string
) {
  const layerTasks = tasks.filter(
    (task) => task.layerId === layerId && task.id !== draggingTaskId
  )
  return layerTasks.length > 0
    ? layerTasks[layerTasks.length - 1].sorting + 1
    : 1
}

function calculateTaskSortingForLayerStart(
  tasks: Task[],
  layerId: string,
  draggingTaskId: string
) {
  const layerTasks = tasks.filter(
    (task) => task.layerId === layerId && task.id !== draggingTaskId
  )

  if (layerTasks.length === 0) return 1

  const minSorting = Math.min(...layerTasks.map((task) => task.sorting))

  return minSorting / 2
}

function calculateTaskSortingBetweenTasks(
  tasks: Task[],
  targetTask: Task | PendingTask,
  draggingTask: Task | PendingTask
) {
  const layerTasks = tasks.filter(
    (task) => task.layerId === targetTask.layerId && task.id !== draggingTask.id
  )

  const draggingDown = targetTask.sorting > draggingTask.sorting
  const index = layerTasks.findIndex(({ id }) => id === targetTask.id)
  const previousTask = layerTasks[index - 1]
  const nextTask = layerTasks[index + 1]

  return draggingDown
    ? nextTask
      ? targetTask.sorting + (nextTask.sorting - targetTask.sorting) / 2
      : layerTasks.length > 0
        ? layerTasks[layerTasks.length - 1].sorting + 1
        : 1
    : previousTask
      ? previousTask.sorting + (targetTask.sorting - previousTask.sorting) / 2
      : targetTask.sorting / 2
}

function makeDragTaskOverSliceHandler(
  draggingTask: PendingTask | undefined,
  setDraggingTask: (task: PendingTask) => void,
  layers: Layer[],
  tasks: Task[]
) {
  return (data: OverSliceData) => {
    if (!draggingTask) return

    const layer = getLastLayer(layers, data.sliceId)
    const nextSorting = calculateTaskSortingForSlice(
      tasks,
      layer.id,
      draggingTask.id
    )

    setDraggingTask({
      ...draggingTask,
      sliceId: layer.sliceId,
      layerId: layer.id,
      sorting: nextSorting,
    })
  }
}

function makeDragTaskOverTaskHandler(
  draggingTask: PendingTask | undefined,
  setDraggingTask: (task: PendingTask) => void,
  layers: Layer[],
  tasks: Task[]
) {
  return (data: OverTaskData) => {
    if (!draggingTask) return
    if (data.task.id === draggingTask.id) return

    const layer = getLayer(layers, data.task.layerId)
    const nextSorting = calculateTaskSortingBetweenTasks(
      tasks,
      data.task,
      draggingTask
    )

    setDraggingTask({
      ...draggingTask,
      sliceId: layer.sliceId,
      layerId: layer.id,
      sorting: nextSorting,
    })
  }
}

function makeDragTaskOverLayerHandler(
  draggingTask: PendingTask | undefined,
  setDraggingTask: (task: PendingTask) => void,
  tasks: Task[]
) {
  return (data: OverLayerData) => {
    if (!draggingTask) return

    const layer = data.layer

    const nextSorting = calculateTaskSortingForLayerStart(
      tasks,
      layer.id,
      draggingTask.id
    )

    setDraggingTask({
      ...draggingTask,
      sliceId: layer.sliceId,
      layerId: layer.id,
      sorting: nextSorting,
    })
  }
}

function makeDragTaskOverHandler(
  draggingTask: PendingTask | undefined,
  setDraggingTask: (task: PendingTask) => void,
  layers: Layer[],
  tasks: Task[]
) {
  const handleDragTaskOverSlice = makeDragTaskOverSliceHandler(
    draggingTask,
    setDraggingTask,
    layers,
    tasks
  )

  const handleDragTaskOverLayer = makeDragTaskOverLayerHandler(
    draggingTask,
    setDraggingTask,
    tasks
  )

  const handleDragTaskOverTask = makeDragTaskOverTaskHandler(
    draggingTask,
    setDraggingTask,
    layers,
    tasks
  )

  return (data: OverData) => {
    if (data.elementType === 'droppableSlice') {
      handleDragTaskOverSlice(data)
      return
    }

    if (data.elementType === 'sortableLayer') {
      handleDragTaskOverLayer(data)
      return
    }

    handleDragTaskOverTask(data)
  }
}

function makeDragSliceOverHandler({
  slices,
  draggingSlice,
  overSliceId,
  setOverSliceId,
}: {
  slices: Slice[]
  draggingSlice: Slice | undefined
  overSliceId: string | undefined
  setOverSliceId: (id: string | undefined) => void
}) {
  return (data: OverData) => {
    if (!draggingSlice) return
    if (data.elementType !== 'droppableSlice') return
    if (!data.sliceId) return
    if (data.sliceId === draggingSlice.id) return

    if (data.sliceId === overSliceId) {
      const draggingIndex = slices.findIndex(
        ({ id }) => id === draggingSlice.id
      )
      const overIndex = slices.findIndex(({ id }) => id === overSliceId)

      if (draggingIndex === -1 || overIndex === -1) return

      const draggingRow = Math.floor(draggingIndex / 3)
      const draggingCol = draggingIndex % 3
      const overRow = Math.floor(overIndex / 3)
      const overCol = overIndex % 3

      const rowDelta = overRow - draggingRow
      const colDelta = overCol - draggingCol

      const nextRow = overRow + Math.sign(rowDelta)
      const nextCol = overCol + Math.sign(colDelta)

      const originalRow = Math.floor((draggingSlice.boxNumber - 1) / 3)
      const originalCol = (draggingSlice.boxNumber - 1) % 3

      if (nextRow === originalRow && nextCol === originalCol) {
        setOverSliceId(undefined)
        return
      }

      if (nextRow < 0 || nextRow > 2 || nextCol < 0 || nextCol > 2) {
        if (overRow === originalRow && overCol === originalCol) {
          setOverSliceId(undefined)
          return
        }

        const overSlice = slices[overIndex]
        const overBoxRow = Math.floor((overSlice.boxNumber - 1) / 3)
        const overBoxCol = (overSlice.boxNumber - 1) % 3

        const targetBoxRow = overBoxRow + Math.sign(rowDelta)
        const targetBoxCol = overBoxCol + Math.sign(colDelta)

        if (
          targetBoxRow >= 0 &&
          targetBoxRow <= 2 &&
          targetBoxCol >= 0 &&
          targetBoxCol <= 2
        ) {
          const targetBoxNumber = targetBoxRow * 3 + targetBoxCol + 1
          const targetSlice = slices.find(
            (s) => s.boxNumber === targetBoxNumber
          )
          if (targetSlice && targetSlice.id !== draggingSlice.id) {
            setOverSliceId(targetSlice.id)
            return
          }
        }

        return
      }

      const nextIndex = nextRow * 3 + nextCol
      const nextSlice = slices[nextIndex]

      if (nextSlice && nextSlice.id !== draggingSlice.id) {
        setOverSliceId(nextSlice.id)
      }

      return
    }

    setOverSliceId(data.sliceId)
  }
}

function captureSliceHeight(
  sliceId: string,
  prefix: 'slice-wrapper' | 'mobile-box-wrapper'
): number | undefined {
  const el = document.querySelector<HTMLDivElement>(`#${prefix}-${sliceId}`)
  return el?.offsetHeight
}

function getNextSorting(tasks: Task[]) {
  return tasks.length > 0 ? tasks[tasks.length - 1].sorting + 1 : 1
}

export type {
  ActiveData,
  ActiveSliceData,
  ActiveTaskData,
  OverData,
  OverLayerData,
  OverSliceData,
  OverTaskData,
  PendingTask,
}

export {
  captureSliceHeight,
  getLayer,
  getNextSorting,
  getTasks,
  makeDragSliceOverHandler,
  makeDragTaskOverHandler,
}
