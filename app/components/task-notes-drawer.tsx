import * as Dialog from '@radix-ui/react-dialog'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { cx } from '~/lib/utils'
import { RichTextEditor } from '~/rich-text-editor'
import { useBoardDispatch, useBoardState, useIsDirty } from '~/state/context'
import type { Task } from '~/state/types'

type TaskNotesContextValue = {
  openTaskId: string | null
  openNotes: (taskId: string) => void
  closeNotes: () => void
}

const TaskNotesContext = createContext<TaskNotesContextValue | undefined>(
  undefined
)

function TaskNotesProvider({ children }: { children: React.ReactNode }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const openNotes = useCallback((taskId: string) => {
    setOpenTaskId(taskId)
  }, [])

  const closeNotes = useCallback(() => {
    setOpenTaskId(null)
  }, [])

  return (
    <TaskNotesContext.Provider value={{ openTaskId, openNotes, closeNotes }}>
      {children}
      <TaskNotesDrawer />
    </TaskNotesContext.Provider>
  )
}

function useTaskNotes() {
  const context = useContext(TaskNotesContext)
  if (!context)
    throw new Error('useTaskNotes must be used within TaskNotesProvider')
  return context
}

function TaskNotesDrawer() {
  const { openTaskId, closeNotes } = useTaskNotes()
  const state = useBoardState()
  const dispatch = useBoardDispatch()
  const isDirty = useIsDirty()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [uiState, setUIState] = useState<'editing' | 'closing'>('editing')

  const task = openTaskId
    ? state.tasks.find((t: Task) => t.id === openTaskId)
    : null

  useEffect(() => {
    if (task) {
      setUIState('editing')
    }
  }, [task?.id])

  useEffect(() => {
    if (!dialogRef.current) return
    if (uiState !== 'closing') return

    Promise.allSettled(
      dialogRef.current.getAnimations().map(({ finished }) => finished)
    ).then(() => closeNotes())
  }, [uiState])

  const close = () => {
    setUIState('closing')
  }

  if (!task) return null

  return (
    <Dialog.Root
      open={uiState !== 'closing'}
      onOpenChange={() => {
        if (document.querySelector('html[data-editing-rich-text]')) return
        close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cx(
            'fixed inset-0 isolate z-40 bg-base-300/75',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in'
          )}
        />
        <Dialog.Content
          ref={dialogRef}
          className={cx(
            'fixed top-0 right-0 isolate z-40 flex h-full w-full flex-col overflow-y-auto bg-base-100 p-6 shadow-xl',
            'data-[state=closed]:animate-slide-out-right data-[state=open]:animate-slide-in-right',
            'md:w-3/4 md:max-w-3xl lg:w-2/3'
          )}
        >
          <div className="relative flex flex-col gap-4">
            <Dialog.Title className="h1">{task.name}</Dialog.Title>
            <button
              className="btn btn-ghost btn-sm btn-square absolute top-0 right-0"
              onClick={close}
            >
              ✕
            </button>
            <Dialog.Description className="sr-only">
              Task notes
            </Dialog.Description>
            <div className="flex h-[85vh] flex-col">
              <div className="flex flex-1 flex-col gap-6">
                <RichTextEditor
                  key={task.id}
                  initialContent={task.notesHtml ?? ''}
                  onChange={(html) => {
                    dispatch({
                      type: 'SET_TASK_NOTES',
                      taskId: task.id,
                      notesHtml: html,
                    })
                  }}
                  className="max-h-[74vh]"
                />
                {isDirty() && (
                  <div className="ml-auto flex items-center gap-1 text-base-content/60 text-xs">
                    Saving...
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { TaskNotesProvider, useTaskNotes }
