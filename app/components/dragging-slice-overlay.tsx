import { cx } from '~/lib/utils'
import type { Layer, Slice, Task } from '~/state/types'
import { CheckIcon } from './check-icon'
import { DragHandleIcon } from './drag-handle-icon'
import { SliceLayers } from './slice-layers'
import { SliceWrapper } from './slice-wrapper'
import { StatusSelect } from './status-select'

type DraggingSliceOverlayProps = {
  slice: Slice & { height?: number }
  variant: 'desktop' | 'mobile'
  selectedSliceId: string | undefined
  layers: Layer[]
  tasks: Task[]
}

function DraggingSliceOverlay({
  slice,
  variant,
  selectedSliceId,
  layers,
  tasks,
}: DraggingSliceOverlayProps) {
  const sliceLayers = layers.filter(({ sliceId }) => sliceId === slice.id)
  const firstLayer = sliceLayers[0]
  const allLayersDone =
    sliceLayers.length > 0 &&
    sliceLayers.every((layer) => layer.status === 'done')

  if (variant === 'mobile') {
    return (
      <div
        className={cx(
          'flex h-[10vh] items-center justify-center overflow-hidden border border-base-content/10 text-center font-bold text-xs sm:hidden',
          selectedSliceId === slice.id ? 'bg-base-100' : 'bg-zinc-300'
        )}
      >
        {allLayersDone && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <CheckIcon className="size-12 text-gray-300" />
          </div>
        )}
        <span className="line-clamp-3 overflow-hidden text-ellipsis">
          {slice.name ?? ' '}
        </span>
      </div>
    )
  }

  return (
    <SliceWrapper
      slice={slice}
      layers={layers}
      style={{ height: slice.height }}
      className="bg-base-100/90"
    >
      <div className="flex items-center gap-1 px-4">
        <div className="mt-0.5 flex flex-1">
          <span
            className={cx(
              'flex flex-1 break-words border border-transparent p-0.5 text-left font-bold text-[16px] leading-[18px]',
              slice.name
                ? 'text-black'
                : 'border-b-neutral-content text-transparent'
            )}
          >
            {slice.name ?? 'Untitled'}
          </span>
        </div>
        {sliceLayers.length === 1 && firstLayer && (
          <StatusSelect layer={firstLayer} />
        )}
        <DragHandleIcon />
      </div>
      <SliceLayers
        layers={sliceLayers}
        tasks={tasks}
        variant="desktop"
        allLayersDone={allLayersDone}
      />
    </SliceWrapper>
  )
}

export { DraggingSliceOverlay }
