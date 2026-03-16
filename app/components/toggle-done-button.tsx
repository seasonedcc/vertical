import { cx } from '~/lib/utils'
import { useBoardDispatch } from '~/state/context'
import type { Task } from '~/state/types'
import { CheckIcon } from './check-icon'
import { useProjectMode } from './project-mode'

function ToggleDoneButton({
  task,
  hideForDragging,
  className,
}: {
  task: Task
  hideForDragging?: boolean
  className?: string
}) {
  const dispatch = useBoardDispatch()
  const { projectMode } = useProjectMode()

  return (
    <button
      tabIndex={0}
      aria-label={task.done ? 'Done' : 'Not done'}
      type="button"
      onClick={(event) => {
        if (projectMode === 'split') return

        event.stopPropagation()
        dispatch({ type: 'SET_TASK_DONE', taskId: task.id, done: !task.done })
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
      }}
      className={cx(
        'h-4 w-4 flex-none translate-y-0.5 items-center justify-center rounded-full border border-base-content/60 shadow-inner outline-hidden focus:border-2 focus:border-neutral-content focus:ring-0 active:border-2',
        hideForDragging && '!opacity-0',
        className
      )}
    >
      {task.done ? (
        <CheckIcon className="h-2.5 w-2.5 translate-x-1 text-gray-400" />
      ) : (
        ''
      )}
    </button>
  )
}

export { ToggleDoneButton }
