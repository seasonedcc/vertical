import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { useEffect, useState } from 'react'
import { sortBy } from '~/lib/utils'
import { useBoardDispatch, useBoardState } from '~/state/context'
import { BoardDragOverlay } from './board-drag-overlay'
import { getTasks } from './drag-helpers'
import { DraggingSliceOverlay } from './dragging-slice-overlay'
import { DraggingTaskOverlay } from './dragging-task-overlay'
import { useProjectMode } from './project-mode'
import { SliceBox } from './slice-box'
import { useBoardDrag } from './use-board-drag'

function DesktopBoard() {
  const dispatch = useBoardDispatch()
  const { layers: rawLayers, tasks: rawTasks } = useBoardState()
  const [selectedSliceId, setSelectedSliceId] = useState<string>()
  const { projectMode, setProjectMode } = useProjectMode()

  const layers = sortBy(rawLayers, ['sliceId', 'sorting'])
  const tasksBeforeDrag = sortBy(rawTasks, ['layerId', 'sorting'])

  const {
    slices,
    draggingTask,
    draggingSlice,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    handleDragOver,
  } = useBoardDrag({
    variant: 'desktop',
    layers,
    tasks: tasksBeforeDrag,
    dispatch,
  })

  const tasks = getTasks({ tasksBeforeDrag, draggingTask })

  useEffect(() => {
    const handleClickOutside = () => {
      setSelectedSliceId(undefined)
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedSliceId(undefined)
        setProjectMode('default')
        return
      }

      if (event.key === 's' || event.key === 'S') {
        if (event.ctrlKey || event.metaKey || event.altKey) return

        const activeElement = document.activeElement
        const isEditing =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          (activeElement instanceof HTMLElement &&
            activeElement.isContentEditable)

        if (isEditing) return

        setProjectMode(projectMode === 'split' ? 'default' : 'split')
      }
    }

    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [projectMode, setProjectMode])

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
            variant="desktop"
            selectedSliceId={selectedSliceId}
            layers={layers}
          />
        )}
        {draggingSlice && (
          <DraggingSliceOverlay
            slice={draggingSlice}
            variant="desktop"
            selectedSliceId={selectedSliceId}
            layers={layers}
            tasks={tasks}
          />
        )}
      </BoardDragOverlay>
      <div className="hidden flex-1 flex-col bg-gray-200 sm:flex sm:overflow-y-auto">
        <div className="relative grid w-full flex-1 auto-rows-max gap-3 p-3 sm:grid-cols-3 xl:overflow-y-auto">
          {slices.map((slice) => {
            return (
              <SliceBox
                key={slice.id}
                variant="desktop"
                slice={slice}
                layers={layers.filter(({ sliceId }) => sliceId === slice.id)}
                tasks={tasks}
                selected={selectedSliceId === slice.id}
                selectSlice={setSelectedSliceId}
              />
            )
          })}
        </div>
      </div>
    </DragDropProvider>
  )
}

export { DesktopBoard }
