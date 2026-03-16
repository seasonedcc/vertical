import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { sortBy } from 'lodash-es'
import { useRef, useState } from 'react'
import { cx } from '~/lib/utils'
import { useBoardDispatch, useBoardState } from '~/state/context'
import type { Layer, Slice } from '~/state/types'
import { BoardDragOverlay } from './board-drag-overlay'
import { CheckIcon } from './check-icon'
import { getTasks } from './drag-helpers'
import { DraggingTaskOverlay } from './dragging-task-overlay'
import { SliceBox } from './slice-box'
import { useBoardDrag } from './use-board-drag'

function BoxThumbnail({
  slice,
  selectedSliceId,
  setSelectedSliceId,
  layers,
}: {
  slice: Slice
  selectedSliceId: string
  setSelectedSliceId: (id: string) => void
  layers: Layer[]
}) {
  const selected = selectedSliceId === slice.id
  const sliceLayers = layers.filter(({ sliceId }) => sliceId === slice.id)
  const allLayersDone =
    sliceLayers.length > 0 &&
    sliceLayers.every((layer) => layer.status === 'done')

  return (
    <div
      id={`mobile-box-wrapper-${slice.id}`}
      className={cx(
        'relative isolate flex h-[10vh] touch-none items-center justify-center overflow-hidden text-center font-bold text-xs shadow-[0_0_0_0.3px_black] sm:hidden',
        selected ? 'border border-black bg-base-100' : 'bg-base-200'
      )}
      onClick={(event) => {
        event.stopPropagation()

        if (selected) {
          return
        }

        setSelectedSliceId(slice.id)
      }}
    >
      {allLayersDone && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <CheckIcon className="size-12 text-gray-300" />
        </div>
      )}
      <span className="z-20 line-clamp-3 overflow-hidden text-ellipsis">
        {slice.name ?? ' '}
      </span>
    </div>
  )
}

function MobileBoard() {
  const dispatch = useBoardDispatch()
  const { layers: rawLayers, tasks: rawTasks } = useBoardState()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const layers = sortBy(rawLayers, ['sliceId', 'sorting'])
  const tasksBeforeDrag = sortBy(rawTasks, ['layerId', 'sorting'])

  const {
    slices,
    draggingTask,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    handleDragOver,
  } = useBoardDrag({
    variant: 'mobile',
    layers,
    tasks: tasksBeforeDrag,
    dispatch,
  })

  const tasks = getTasks({ tasksBeforeDrag, draggingTask })

  const [selectedSliceId, setSelectedSliceId] = useState<string>(
    slices[0]?.id || ''
  )

  // biome-ignore lint/style/noNonNullAssertion: selectedSliceId is always a valid slice
  const selectedSlice = slices.find((slice) => slice.id === selectedSliceId)!

  return (
    <DragDropProvider
      sensors={[PointerSensor, KeyboardSensor]}
      onDragStart={handleDragStart}
      onDragEnd={(event, manager) => {
        if (event.canceled) {
          handleDragCancel()
          return
        }
        handleDragEnd(event, manager)
      }}
      onDragOver={handleDragOver}
    >
      <BoardDragOverlay>
        {draggingTask && (
          <DraggingTaskOverlay
            task={draggingTask}
            variant="mobile"
            selectedSliceId={selectedSliceId}
            layers={layers}
          />
        )}
      </BoardDragOverlay>
      <div className="grid grid-cols-3 border-black border-b-2 sm:hidden">
        {slices.map((slice) => {
          return (
            <BoxThumbnail
              key={slice.id}
              slice={slice}
              selectedSliceId={selectedSliceId}
              setSelectedSliceId={setSelectedSliceId}
              layers={layers}
            />
          )
        })}
      </div>
      <div
        className="flex-1 overflow-y-auto bg-base-100 sm:hidden"
        ref={wrapperRef}
      >
        {selectedSlice && (
          <SliceBox
            variant="mobile"
            slice={selectedSlice}
            layers={layers.filter(
              ({ sliceId }) => sliceId === selectedSlice.id
            )}
            tasks={tasks}
          />
        )}
      </div>
    </DragDropProvider>
  )
}

export { MobileBoard }
