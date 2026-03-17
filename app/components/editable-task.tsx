import { useSortable } from '@dnd-kit/react/sortable'
import { StickyNoteIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { cx, usePlaceCursorOnClickedPosition } from '~/lib/utils'
import { useBoardDispatch } from '~/state/context'
import type { Task } from '~/state/types'
import { DragHandleIcon } from './drag-handle-icon'
import type { OverTaskData } from './drag-helpers'
import { useProjectMode } from './project-mode'
import { useTaskNotes } from './task-notes-drawer'
import { ToggleDoneButton } from './toggle-done-button'

function EditableTask({
  task,
  onDeleted,
  onTaskCreatedAfter,
  index,
  variant,
}: {
  task: Task
  index: number
  onDeleted: (index: number) => void
  onTaskCreatedAfter: (index: number) => void
  variant: 'desktop' | 'mobile'
}) {
  const dispatch = useBoardDispatch()
  const { openNotes } = useTaskNotes()
  const [editing, setEditing] = useState(false)
  const [height, setHeight] = useState(16)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { handleClick, handleFocus } = usePlaceCursorOnClickedPosition()
  const { projectMode } = useProjectMode()

  const { ref, handleRef, isDragging } = useSortable({
    id: `task:${task.id}`,
    index,
    data: {
      elementType: 'sortableTask',
      task,
    } satisfies OverTaskData,
  })

  const submitEdit = () => {
    if (!textAreaRef.current) return

    if (textAreaRef.current.value === '') {
      dispatch({ type: 'DELETE_TASK', taskId: task.id })
      onDeleted(index)
      return
    }

    const value = textAreaRef.current.value.trim()

    if (value && value !== task.name) {
      dispatch({ type: 'RENAME_TASK', taskId: task.id, name: value })
    }
  }

  if (editing) {
    return (
      <form
        style={{ height }}
        className="h-5 w-full"
        onSubmit={(event) => {
          event.preventDefault()
          submitEdit()

          flushSync(() => {
            setEditing(false)
          })
          buttonRef.current?.focus()
        }}
      >
        <div className="flex w-full items-start gap-1">
          {variant === 'mobile' && <DragHandleIcon />}
          <ToggleDoneButton task={task} />
          <textarea
            className="flex-grow translate-x-1 resize-none overflow-hidden border-0 bg-transparent p-0.5 pb-0 text-[12px] text-base-content/60 leading-[16px] placeholder:text-base-content/60 focus:shadow-md focus:ring-1 focus:ring-indigo-600"
            style={{ height }}
            ref={textAreaRef}
            aria-label={task.name}
            name="name"
            defaultValue={task.name}
            onFocus={handleFocus}
            onKeyDown={(event) => {
              event.stopPropagation()

              if (event.key === 'Escape') {
                flushSync(() => {
                  setEditing(false)
                })
                buttonRef.current?.focus()
              } else if (event.key === 'Enter') {
                event.preventDefault()

                const textarea = textAreaRef.current
                const isAtEnd =
                  textarea &&
                  textarea.selectionStart === textarea.value.length &&
                  textarea.selectionEnd === textarea.value.length

                if (event.shiftKey && isAtEnd) {
                  submitEdit()

                  dispatch({
                    type: 'CREATE_TASK_AFTER',
                    id: crypto.randomUUID(),
                    afterTaskId: task.id,
                  })

                  flushSync(() => {
                    setEditing(false)
                  })
                  onTaskCreatedAfter(index)
                } else if (!event.shiftKey) {
                  submitEdit()
                  flushSync(() => {
                    setEditing(false)
                  })
                  buttonRef.current?.focus()
                }
              }
            }}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const newHeight = (event.target as HTMLTextAreaElement)
                .scrollHeight
              if (height === newHeight) return

              setHeight(newHeight)
            }}
            onBlur={() => {
              submitEdit()
              setEditing(false)
            }}
          />
        </div>
      </form>
    )
  }

  return (
    <div
      ref={(node) => {
        ref(node)
        ;(wrapperRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node
      }}
      {...(variant === 'desktop' ? { tabIndex: -1 as const } : {})}
      className={cx(
        'group/task flex w-full items-start gap-1 rounded',
        variant === 'desktop' && 'touch-none',
        isDragging && 'bg-neutral-content/50 pb-1 text-transparent blur-xs'
      )}
    >
      {variant === 'mobile' && (
        <DragHandleIcon
          ref={handleRef}
          onClick={(event) => {
            event.stopPropagation()
          }}
          className={cx('touch-none', isDragging && 'focus:border-transparent')}
          tabIndex={-1}
        />
      )}
      <ToggleDoneButton
        className={cx(
          variant === 'desktop' &&
            'opacity-[var(--idle-opacity)] group-hover:opacity-[var(--hover-opacity)]'
        )}
        hideForDragging={isDragging}
        task={task}
      />
      <button
        tabIndex={0}
        className={cx(
          'flex-grow cursor-text break-words border-2 border-transparent px-1 text-left text-[12px] text-base-content/60 leading-[16px] outline-hidden focus:border-gray-100 focus:ring-0 active:border-transparent',
          isDragging
            ? 'text-transparent focus:border-transparent'
            : 'focus:border-neutral-content',
          task.done && 'line-through'
        )}
        ref={buttonRef}
        aria-label={task.name}
        type="button"
        data-task-index={index}
        onKeyDown={(event) => {
          if (['Backspace', 'Delete'].includes(event.key)) {
            event.stopPropagation()
            dispatch({ type: 'DELETE_TASK', taskId: task.id })
            onDeleted(index)
          }
        }}
        onClick={(event) => {
          if (projectMode === 'split') return

          event.stopPropagation()
          const buttonHeight = wrapperRef.current?.offsetHeight ?? 16

          handleClick(event)

          flushSync(() => {
            setHeight(buttonHeight)
          })

          flushSync(() => {
            setEditing(true)
          })

          textAreaRef.current?.focus()
        }}
      >
        {task.name}
      </button>
      <button
        type="button"
        className={cx(
          'mt-0.5 flex-none rounded p-0.5 hover:bg-base-300',
          task.notesHtml
            ? 'text-base-content/40'
            : 'text-base-content/20 opacity-0 group-hover/task:opacity-100',
          isDragging && 'invisible'
        )}
        title="Notes"
        onClick={(event) => {
          event.stopPropagation()
          openNotes(task.id)
        }}
      >
        <StickyNoteIcon className="size-3" />
      </button>
    </div>
  )
}

export { EditableTask }
