import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
  subscribeToEvents,
} from '~/file/api'
import type { BoardSummary } from '~/file/api'
import logo from '~/images/logo.png'

function Workspace() {
  const [projects, setProjects] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const refresh = () => {
      listProjects()
        .then(setProjects)
        .catch((err) => setError(err.message))
    }
    refresh()
    return subscribeToEvents(refresh, () => {})
  }, [])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || creating) return
    setCreating(true)
    try {
      const board = await createProject(trimmed)
      navigate(`/projects/${board.id}`)
    } catch (err) {
      setError((err as Error).message)
      setCreating(false)
    }
  }

  const handleRename = async (board: BoardSummary) => {
    const next = window.prompt('Rename project', board.name)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === board.name) return
    await renameProject(board.id, trimmed)
    listProjects()
      .then(setProjects)
      .catch((err) => setError(err.message))
  }

  const handleDelete = async (board: BoardSummary) => {
    if (!window.confirm(`Delete "${board.name}"? This removes its file.`))
      return
    await deleteProject(board.id)
    listProjects()
      .then(setProjects)
      .catch((err) => setError(err.message))
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-200">
      <div
        data-theme="dark"
        className="navbar sticky top-0 z-10 gap-2 bg-(--dark-bg) px-4 lg:px-6"
      >
        <div className="flex shrink-0 items-center gap-2">
          <img src={logo} alt="Vertical" className="max-w-8" />
          <span className="font-bold text-white">Vertical</span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <form className="flex gap-2" onSubmit={handleCreate}>
          <input
            className="input input-bordered flex-1"
            placeholder="New project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={creating}>
            Create
          </button>
        </form>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        {projects && projects.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">
            <p className="font-medium">No projects yet</p>
            <p className="text-sm">Create your first board above.</p>
          </div>
        )}

        {projects && projects.length > 0 && (
          <ul className="flex flex-col gap-2">
            {projects.map((board) => (
              <li
                key={board.id}
                className="flex items-center gap-2 rounded-lg bg-white p-4 shadow-sm"
              >
                <Link
                  to={`/projects/${board.id}`}
                  className="flex flex-1 flex-col"
                >
                  <span className="font-medium">{board.name}</span>
                  <span className="text-gray-400 text-xs">{board.id}</span>
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRename(board)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => handleDelete(board)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export { Workspace }
