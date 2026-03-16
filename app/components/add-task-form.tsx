import { useRef } from 'react'
import { cx } from '~/lib/utils'
import { useBoardDispatch } from '~/state/context'
import type { Layer, Task } from '~/state/types'
import { DragHandleIcon } from './drag-handle-icon'
import { getNextSorting } from './drag-helpers'

function AddTaskForm({
  layer,
  tasks,
  variant,
}: {
  layer: Layer
  tasks: Task[]
  variant: 'desktop' | 'mobile'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dispatch = useBoardDispatch()

  const nextSorting = getNextSorting(tasks)

  const opacityClasses =
    'opacity-[var(--idle-opacity)] group-hover:opacity-[var(--hover-opacity)]'

  return (
    <div className="flex gap-1">
      <form
        className="flex w-full items-start gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          if (!inputRef?.current) return

          const name = inputRef.current.value.trim()
          if (!name) return

          dispatch({
            type: 'CREATE_TASK',
            id: crypto.randomUUID(),
            layerId: layer.id,
            name,
            sorting: nextSorting,
          })

          inputRef.current.value = ''
          inputRef.current.focus()
        }}
      >
        {variant === 'mobile' && (
          <DragHandleIcon
            className={cx('pointer-events-none opacity-0', opacityClasses)}
          />
        )}
        <button
          type="button"
          tabIndex={-1}
          className={cx(
            'pointer-events-none h-4 w-4 flex-none translate-y-0.5 rounded-full border border-base-content/30 shadow-inner',
            opacityClasses
          )}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          data-task-input
          data-1p-ignore
          data-lpignore
          data-form-type="other"
          name="name"
          placeholder=" "
          autoComplete="off"
          className={cx(
            'w-1/2 translate-x-1 resize-none border-0 border-base-content/20 border-b bg-transparent p-0.5 pb-0 text-[12px] text-base-content/60 leading-[16px] transition-all focus:w-full focus:border-0 focus:shadow-md focus:ring-1 focus:ring-indigo-600',
            opacityClasses
          )}
        />
        <button type="submit" className="hidden" />
      </form>
    </div>
  )
}

export { AddTaskForm }
