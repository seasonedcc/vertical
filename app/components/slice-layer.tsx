import { useDroppable } from '@dnd-kit/react'
import { ChevronRightIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { Layer, Task } from '~/state/types'
import { CheckIcon } from './check-icon'
import type { OverLayerData } from './drag-helpers'
import { EditableLayer } from './editable-layer'
import { StatusSelect } from './status-select'
import { TaskList } from './task-list'

function SliceLayer({
  layer,
  tasks,
  layerIndex,
  totalLayers,
  variant,
  allLayersDone,
}: {
  layer: Layer
  tasks: Task[]
  layerIndex: number
  totalLayers: number
  variant: 'mobile' | 'desktop'
  allLayersDone: boolean
}) {
  const { status } = layer
  const [expanded, setExpanded] = useState(status !== 'done')

  const { ref } = useDroppable({
    id: `droppable-layer:${layer.id}`,
    data: {
      elementType: 'sortableLayer',
      layer,
    } satisfies OverLayerData,
  })

  useEffect(() => {
    setExpanded(status !== 'done')
  }, [status])

  const layerTasks = tasks.filter(({ layerId }) => layerId === layer.id)
  const isDone = status === 'done'
  const showLayerCheckmark = isDone && !allLayersDone

  const layerPlaceholder = layerIndex === 0 ? 'First' : 'Then'

  return (
    <div ref={ref} className="group relative isolate flex gap-2">
      <div className={twMerge('flex w-full flex-col', isDone && 'group')}>
        {expanded && (totalLayers > 1 || isDone) && (
          <div className="flex items-start gap-1 px-4">
            {isDone ? (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex size-4 shrink-0 translate-y-0.5 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-base-content/10 group-hover:opacity-100"
              >
                <ChevronRightIcon className="size-3 rotate-90 text-base-content/60" />
              </button>
            ) : (
              <div className="size-4 shrink-0" />
            )}
            {totalLayers > 1 ? (
              <EditableLayer
                id={layer.id}
                name={layer.name}
                placeholder={layerPlaceholder}
              />
            ) : (
              <span className="p-0.5 font-normal text-base-content/60 text-xs leading-4">
                ({layerTasks.length}{' '}
                {layerTasks.length === 1 ? 'task' : 'tasks'})
              </span>
            )}
          </div>
        )}
        {expanded ? (
          <TaskList variant={variant} layer={layer} tasks={layerTasks} />
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex items-start gap-1 px-4">
              {isDone && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="flex size-4 shrink-0 translate-y-0.5 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-base-content/10 group-hover:opacity-100"
                >
                  <ChevronRightIcon className="size-3 text-base-content/60" />
                </button>
              )}
              <div className="flex gap-1 font-normal text-base-content/60 text-xs leading-4">
                {totalLayers > 1 ? (
                  <EditableLayer
                    id={layer.id}
                    name={layer.name}
                    placeholder={layerPlaceholder}
                    suffix={`(${layerTasks.length} ${layerTasks.length === 1 ? 'task' : 'tasks'})`}
                  />
                ) : (
                  <span className="p-0.5">
                    ({layerTasks.length}{' '}
                    {layerTasks.length === 1 ? 'task' : 'tasks'})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {totalLayers > 1 && (
        <div className="mr-4 flex flex-col items-end gap-2">
          <StatusSelect layer={layer} />
        </div>
      )}
      {showLayerCheckmark && (
        <div className="-z-10 absolute inset-0 flex items-center justify-center">
          <CheckIcon
            className={twMerge('h-10 w-10 text-gray-300 opacity-60')}
          />
        </div>
      )}
    </div>
  )
}

export { SliceLayer }
