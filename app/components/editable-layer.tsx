import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { usePlaceCursorOnClickedPosition } from '~/lib/utils'
import { useBoardDispatch } from '~/state/context'

function EditableLayer({
  id,
  name,
  placeholder = 'Then',
  suffix,
}: {
  id: string
  name: string | undefined | null
  placeholder?: string
  suffix?: string
}) {
  const dispatch = useBoardDispatch()
  const [editing, setEditing] = useState(false)
  const [height, setHeight] = useState(16)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { handleClick, handleFocus } = usePlaceCursorOnClickedPosition()

  const submitEdit = () => {
    if (!textAreaRef.current) return

    const value = textAreaRef.current.value.trim()

    if (!value) {
      dispatch({ type: 'UNNAME_LAYER', layerId: id })
      return
    }

    if (value !== name) {
      dispatch({ type: 'RENAME_LAYER', layerId: id, name: value })
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

          buttonRef.current?.focus()
        }}
      >
        <textarea
          className="w-full resize-none overflow-hidden break-words border border-transparent bg-transparent px-1 py-0.5 text-[12px] uppercase leading-[16px] outline-hidden placeholder:text-base-content/40 focus:border-gray-100 focus:shadow-md focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
          style={{ height }}
          ref={textAreaRef}
          aria-label={name ?? ''}
          name="name"
          placeholder={placeholder}
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

  const label = name ?? placeholder

  return (
    <button
      tabIndex={0}
      className="flex flex-1 cursor-text break-words border border-transparent px-1 py-0.5 text-left text-[12px] text-base-content/60 uppercase leading-[16px] focus:border-neutral-content focus:outline-hidden active:border-transparent"
      aria-label={name ?? placeholder}
      type="button"
      ref={buttonRef}
      onClick={(event) => {
        const buttonHeight = buttonRef.current?.offsetHeight ?? 16

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
      {suffix && <span className="normal-case">&nbsp;{suffix}</span>}
    </button>
  )
}

export { EditableLayer }
