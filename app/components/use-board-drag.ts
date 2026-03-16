import { arrayMove } from '@dnd-kit/helpers'
import type { DragDropEvents } from '@dnd-kit/react'
import { sortBy } from 'lodash-es'
import { useState } from 'react'
import type { BoardAction } from '~/state/actions'
import { useBoardState } from '~/state/context'
import type { Layer, Slice, Task } from '~/state/types'
import {
  captureSliceHeight,
  getLayer,
  makeDragSliceOverHandler,
  makeDragTaskOverHandler,
} from './drag-helpers'
import type { ActiveData, OverData, PendingTask } from './drag-helpers'

type UseBoardDragConfig = {
  variant: 'desktop' | 'mobile'
  layers: Layer[]
  tasks: Task[]
  dispatch: (action: BoardAction) => void
}

function useBoardDrag({
  variant,
  layers,
  tasks,
  dispatch,
}: UseBoardDragConfig) {
  const { slices: rawSlices } = useBoardState()
  const stateSlices = sortBy(rawSlices, 'boxNumber')

  const [draggingTask, setDraggingTask] = useState<PendingTask>()
  const [draggingSlice, setDraggingSlice] = useState<
    Slice & { height?: number }
  >()
  const [overSliceId, setOverSliceId] = useState<string>()

  const slices = (() => {
    if (!(draggingSlice && overSliceId !== undefined)) return stateSlices
    if (overSliceId === draggingSlice.id) return stateSlices

    const oldIndex = stateSlices.findIndex(
      ({ boxNumber }) => boxNumber === draggingSlice.boxNumber
    )
    const newIndex = stateSlices.findIndex(({ id }) => id === overSliceId)

    return arrayMove(stateSlices, oldIndex, newIndex)
  })()

  const reset = () => {
    setDraggingTask(undefined)
    setDraggingSlice(undefined)
    setOverSliceId(undefined)
  }

  const handleDragTaskOver = makeDragTaskOverHandler(
    draggingTask,
    setDraggingTask,
    layers,
    tasks
  )

  const handleDragSliceOver = makeDragSliceOverHandler({
    slices,
    draggingSlice,
    overSliceId,
    setOverSliceId,
  })

  const handleDragOver: DragDropEvents['dragover'] = (event) => {
    const data = event.operation.target?.data as OverData | undefined

    if (!data) return

    if (draggingTask) {
      handleDragTaskOver(data)
      return
    }

    if (draggingSlice) {
      handleDragSliceOver(data)
      return
    }
  }

  const handleDragStart: DragDropEvents['dragstart'] = (event) => {
    const data = event.operation.source?.data as ActiveData | undefined
    if (!data) return

    if (data.elementType === 'draggableSlice') {
      const prefix =
        variant === 'desktop' ? 'slice-wrapper' : 'mobile-box-wrapper'
      const height = captureSliceHeight(data.slice.id, prefix)
      setDraggingSlice({
        ...data.slice,
        height,
      })
      return
    }

    const layer = getLayer(layers, data.task.layerId)
    setDraggingTask({
      ...data.task,
      sliceId: layer.sliceId,
    })
  }

  const handleDragEnd: DragDropEvents['dragend'] = () => {
    if (draggingTask) {
      dispatch({
        type: 'MOVE_TASK',
        taskId: draggingTask.id,
        layerId: draggingTask.layerId,
        sorting: draggingTask.sorting,
      })
    }

    if (draggingSlice && overSliceId !== undefined) {
      dispatch({
        type: 'SORT_SLICES',
        slices: slices.map((s, i) => ({ id: s.id, boxNumber: i + 1 })),
      })
    }

    reset()
  }

  return {
    slices,
    draggingTask,
    draggingSlice,
    handleDragStart,
    handleDragEnd,
    handleDragCancel: reset,
    handleDragOver,
  }
}

export { useBoardDrag }
