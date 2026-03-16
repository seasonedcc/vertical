import { closestCenter } from '@dnd-kit/collision'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import type { CSSProperties } from 'react'
import { cx } from '~/lib/utils'
import type { Layer, Slice, Task } from '~/state/types'
import { DragHandleIcon } from './drag-handle-icon'
import type { ActiveSliceData, OverSliceData } from './drag-helpers'
import { EditableSlice } from './editable-slice'
import { SliceLayers } from './slice-layers'
import { SliceWrapper } from './slice-wrapper'
import { StatusSelect } from './status-select'

type SliceBoxProps = {
  slice: Slice
  layers: Layer[]
  tasks: Task[]
} & (
  | {
      variant: 'desktop'
      selected: boolean
      selectSlice: (id: string | undefined) => void
    }
  | {
      variant: 'mobile'
    }
)

function SliceBox(props: SliceBoxProps) {
  const { slice, layers, tasks, variant } = props
  const {
    ref: draggableRef,
    handleRef,
    isDragging,
  } = useDraggable({
    id: `draggable-slice:${slice.id}`,
    data: { elementType: 'draggableSlice', slice } satisfies ActiveSliceData,
  })

  const { ref: droppableRef } = useDroppable({
    id: `droppable-slice:${slice.id}`,
    data: {
      elementType: 'droppableSlice',
      sliceId: slice.id,
    } satisfies OverSliceData,
    collisionDetector: closestCenter,
  })

  const selected = variant === 'desktop' ? props.selected : false
  const selectSlice =
    variant === 'desktop' ? props.selectSlice : () => undefined

  const opacityClasses =
    'opacity-[var(--idle-opacity)] group-hover:opacity-[var(--hover-opacity)] transition-all duration-300'

  const sliceLayers = layers.filter((l) => l.sliceId === slice.id)
  const firstLayer = sliceLayers[0]
  const showStatusSelect = sliceLayers.length === 1 && firstLayer
  const allLayersDone =
    sliceLayers.length > 0 &&
    sliceLayers.every((layer) => layer.status === 'done')

  return (
    <SliceWrapper
      slice={slice}
      layers={layers}
      ref={(node) => {
        draggableRef(node)
        droppableRef(node)
      }}
      id={cx(
        variant === 'desktop' && `slice-wrapper-${slice.id}`,
        variant === 'mobile' && `mobile-slice-wrapper-${slice.id}`
      )}
      style={
        {
          '--hover-opacity': selected ? 1 : 1,
          '--idle-opacity': selected ? 1 : 0,
        } as CSSProperties
      }
      className={cx(
        'group duration-200',
        selected && 'z-[1] shadow-xl ring-2 ring-base-content/40',
        isDragging && variant === 'desktop' && 'opacity-40'
      )}
      {...(variant === 'desktop'
        ? {
            onClick: (event: React.MouseEvent) => {
              event.stopPropagation()
              selectSlice(selected ? undefined : slice.id)
            },
            onFocusCapture: () => selectSlice(slice.id),
          }
        : {})}
    >
      <div className="flex items-center gap-1 px-4">
        <div
          onClick={(event) => event.stopPropagation()}
          className={cx(!slice.name && opacityClasses, 'mt-0.5 flex flex-1')}
        >
          <EditableSlice id={slice.id} name={slice.name} />
        </div>
        {showStatusSelect && (
          <StatusSelect
            layer={firstLayer}
            className={cx(
              firstLayer.status === null &&
                'opacity-[var(--idle-opacity)] group-hover:opacity-[var(--hover-opacity)]'
            )}
          />
        )}
        {variant === 'desktop' && (
          <DragHandleIcon
            ref={handleRef}
            onClick={(event) => {
              event.stopPropagation()
            }}
            className={cx(
              'touch-none',
              isDragging && 'focus:border-transparent',
              opacityClasses
            )}
          />
        )}
      </div>
      <SliceLayers
        layers={layers}
        tasks={tasks}
        variant={variant}
        allLayersDone={allLayersDone}
      />
    </SliceWrapper>
  )
}

export { SliceBox }
