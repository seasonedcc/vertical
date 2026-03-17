import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { cx, usePlaceCursorOnClickedPosition } from '~/lib/utils'
import { useBoardDispatch } from '~/state/context'

function EditableSlice({
  id,
  name,
}: {
  id: string
  name: string | undefined | null
}) {
  const dispatch = useBoardDispatch()
  const [editing, setEditing] = useState(false)
  const [height, setHeight] = useState(18)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { handleClick, handleFocus } = usePlaceCursorOnClickedPosition()

  const submitEdit = () => {
    if (!textAreaRef.current) return

    const value = textAreaRef.current.value.trim()

    if (!value) {
      dispatch({ type: 'UNNAME_SLICE', sliceId: id })
      return
    }

    if (value !== name) {
      dispatch({ type: 'RENAME_SLICE', sliceId: id, name: value })
    }
  }

  if (editing) {
    return (
      <form
        className="flex-1"
        style={{ height }}
        onSubmit={(event) => {
          event.preventDefault()
          submitEdit()

          flushSync(() => {
            setEditing(false)
          })

          document
            .querySelector<HTMLInputElement>(
              `[data-slice-wrapper='${id}'] [data-task-input]`
            )
            ?.focus()
        }}
      >
        <textarea
          className="w-full resize-none overflow-hidden break-words border border-transparent bg-transparent p-0.5 font-bold text-[16px] leading-[18px] outline-hidden placeholder:font-bold focus:border-gray-100 focus:shadow-md focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
          style={{ height }}
          ref={textAreaRef}
          aria-label={name ?? ''}
          name="name"
          defaultValue={name ?? ''}
          onFocus={handleFocus}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()

              flushSync(() => {
                setEditing(false)
              })
              buttonRef.current?.focus()
            } else if (event.key === 'Enter') {
              event.preventDefault()
              submitEdit()
              flushSync(() => {
                setEditing(false)
              })
              buttonRef.current?.focus()
            }
          }}
          onChange={(event) => {
            const newHeight =
              (event.target as HTMLTextAreaElement).scrollHeight + 2

            if (height === newHeight) return

            setHeight(newHeight)
          }}
          onBlur={() => {
            submitEdit()
            setEditing(false)
          }}
        />
      </form>
    )
  }

  const label = name ?? 'Untitled'

  return (
    <button
      tabIndex={0}
      className={cx(
        'flex flex-1 cursor-text break-words border border-transparent p-0.5 text-left font-bold text-[16px] leading-[18px] focus:border-neutral-content focus:outline-hidden active:border-transparent',
        name
          ? 'text-black'
          : 'border-b-neutral-content text-transparent active:border-b-neutral-content'
      )}
      aria-label={label}
      type="button"
      ref={buttonRef}
      onClick={(event) => {
        const buttonHeight = buttonRef.current?.offsetHeight ?? 18

        handleClick(event)
        flushSync(() => {
          setHeight(buttonHeight)
        })

        flushSync(() => {
          setEditing(true)
        })

        if (!textAreaRef.current) return

        textAreaRef.current.focus()
      }}
    >
      {label}
    </button>
  )
}

export { EditableSlice }
