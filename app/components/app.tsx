import { useEffect, useState } from 'react'
import { fetchMode, fetchProject } from '~/file/api'
import { BoardProvider } from '~/state/context'
import type { BoardState } from '~/state/types'
import { Board } from './board'
import { Layout } from './layout'
import { ProjectModeProvider } from './project-mode'
import { TaskNotesProvider } from './task-notes-drawer'

function App() {
  const [boardState, setBoardState] = useState<BoardState | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchProject(), fetchMode()])
      .then(([state, mode]) => {
        setReadOnly(mode.readOnly)
        setBoardState(state)
      })
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-gray-200">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!boardState) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-gray-200">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  return (
    <BoardProvider initialState={boardState} readOnly={readOnly}>
      <ProjectModeProvider>
        <TaskNotesProvider>
          <Layout>
            <Board />
          </Layout>
        </TaskNotesProvider>
      </ProjectModeProvider>
    </BoardProvider>
  )
}

export { App }
