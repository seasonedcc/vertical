import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  fetchProject,
  reportDirty,
  saveProject,
  subscribeToFileChanges,
} from '~/file/api'
import logo from '~/images/logo.png'
import { cx, usePlaceCursorOnClickedPosition } from '~/lib/utils'
import {
  useBoardDispatch,
  useBoardState,
  useIsDirty,
  useMarkClean,
} from '~/state/context'
import { useProjectMode } from './project-mode'

function EditableProjectName({
  name: nameProp,
}: {
  name: string
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
    if (!value) return

    if (value !== nameProp) {
      dispatch({ type: 'RENAME_PROJECT', name: value })
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
        }}
      >
        <textarea
          className="w-full resize-none overflow-hidden break-words border border-transparent bg-transparent p-0.5 font-bold text-[14px] text-white leading-[16px] outline-hidden placeholder:font-bold focus:border-gray-100 focus:shadow-md focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
          style={{ height }}
          ref={textAreaRef}
          aria-label={nameProp}
          name="name"
          defaultValue={nameProp}
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

  return (
    <button
      tabIndex={0}
      className="flex flex-1 cursor-text break-words border border-transparent p-0.5 text-left font-bold text-[14px] text-white leading-[16px] focus:border-neutral-content focus:outline-hidden active:border-transparent"
      aria-label={nameProp}
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
      {nameProp}
    </button>
  )
}

function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const state = useBoardState()
  const dispatch = useBoardDispatch()
  const isDirty = useIsDirty()
  const markClean = useMarkClean()
  const { projectMode, setProjectMode } = useProjectMode()
  const dirtyRef = useRef(false)

  const handleSave = async () => {
    await saveProject(state)
    markClean()
  }

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [state])

  const dirty = isDirty()
  dirtyRef.current = dirty

  useEffect(() => {
    reportDirty(dirty)
  }, [dirty])

  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      saveProject(state).then(markClean)
    }, 1000)
    return () => clearTimeout(timer)
  }, [dirty, state])

  useEffect(() => {
    return subscribeToFileChanges(async () => {
      if (dirtyRef.current) return
      const newState = await fetchProject()
      dispatch({ type: 'LOAD_STATE', state: newState })
    })
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  return (
    <div
      className={cx(
        'flex h-[100dvh] flex-col lg:overflow-hidden',
        projectMode === 'split' && 'split-mode-cursor'
      )}
    >
      <title>{state.project.name}</title>
      <div
        data-theme="dark"
        className="navbar sticky top-0 z-10 gap-2 bg-(--dark-bg) px-4 lg:px-6"
      >
        <div className="flex shrink-0 items-center">
          <img src={logo} alt="Vertical" className="max-w-8" />
        </div>
        <EditableProjectName name={state.project.name} />
        {dirty && (
          <span className="flex items-center gap-1 text-accent text-xs">
            ● Saving...
          </span>
        )}
        <ul className="menu menu-horizontal ml-auto shrink-0 flex-nowrap gap-1 px-1">
          <li>
            <button
              className={cx(
                'btn btn-neutral btn-sm hidden sm:inline-flex',
                projectMode === 'split' && 'ring-2 ring-accent'
              )}
              onClick={() =>
                setProjectMode(projectMode === 'split' ? 'default' : 'split')
              }
            >
              <span className="text-2xl">✂</span>
            </button>
          </li>
        </ul>
      </div>
      {children}
    </div>
  )
}

export { Layout }
