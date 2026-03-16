import { cx } from '~/lib/utils'
import type { Layer } from '~/state/types'
import { DragHandleIcon } from './drag-handle-icon'
import type { PendingTask } from './drag-helpers'
import { ToggleDoneButton } from './toggle-done-button'

type DraggingTaskOverlayProps = {
  task: PendingTask
  variant: 'desktop' | 'mobile'
  selectedSliceId: string | undefined
  layers: Layer[]
}

function DraggingTaskOverlay({ task, variant }: DraggingTaskOverlayProps) {
  return (
    <div
      className={cx(
        'flex items-start gap-2 rounded-md bg-base-100 p-1 text-left text-[12px] text-base-content/60 leading-[16px] shadow-md',
        task.done && 'line-through'
      )}
    >
      {variant === 'mobile' && (
        <div className="flex gap-1">
          <DragHandleIcon />
          <ToggleDoneButton task={task} />
        </div>
      )}
      {variant === 'desktop' && <ToggleDoneButton task={task} />}
      {task.name}
    </div>
  )
}

export { DraggingTaskOverlay }
