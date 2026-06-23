import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { loadBoard } from '~/file/api'
import type { LoadedBoard } from '~/file/api'
import { BoardProvider } from '~/state/context'
import { Board } from './board'
import { Layout } from './layout'
import { ProjectModeProvider } from './project-mode'
import { TaskNotesProvider } from './task-notes-drawer'
import { Workspace } from './workspace'

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-gray-200">
      {children}
    </div>
  )
}

function ProjectRoute() {
  const params = useParams()
  const boardId = params['*'] ?? ''
  const [board, setBoard] = useState<LoadedBoard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBoard(null)
    setError(null)
    loadBoard(boardId)
      .then(setBoard)
      .catch((err) => setError(err.message))
  }, [boardId])

  if (error) {
    return (
      <CenteredScreen>
        <div className="rounded-lg bg-white p-8 shadow-md">
          <p className="text-red-600">{error}</p>
        </div>
      </CenteredScreen>
    )
  }

  if (!board) {
    return (
      <CenteredScreen>
        <span className="loading loading-spinner loading-lg" />
      </CenteredScreen>
    )
  }

  return (
    <BoardProvider key={boardId} boardId={boardId} initialBoard={board}>
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/projects/*" element={<ProjectRoute />} />
      </Routes>
    </BrowserRouter>
  )
}

export { App }
