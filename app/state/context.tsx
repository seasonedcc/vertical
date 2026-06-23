import { createContext, useContext } from 'react'
import type { LoadedBoard } from '~/file/api'
import { useBoardSync } from '~/sync/use-board-sync'
import type { BoardAction } from './actions'
import type { BoardState } from './types'

type BoardSyncStatus = {
  syncing: boolean
  conflict: number
  disconnected: boolean
}

type BoardContextValue = {
  state: BoardState
  dispatch: (action: BoardAction) => void
  status: BoardSyncStatus
}

const BoardContext = createContext<BoardContextValue | undefined>(undefined)

function BoardProvider({
  boardId,
  initialBoard,
  children,
}: {
  boardId: string
  initialBoard: LoadedBoard
  children: React.ReactNode
}) {
  const { state, dispatch, syncing, conflict, disconnected } = useBoardSync(
    boardId,
    initialBoard
  )

  return (
    <BoardContext.Provider
      value={{ state, dispatch, status: { syncing, conflict, disconnected } }}
    >
      {children}
    </BoardContext.Provider>
  )
}

function useBoardState() {
  const context = useContext(BoardContext)
  if (!context)
    throw new Error('useBoardState must be used within BoardProvider')
  return context.state
}

function useBoardDispatch() {
  const context = useContext(BoardContext)
  if (!context)
    throw new Error('useBoardDispatch must be used within BoardProvider')
  return context.dispatch
}

function useBoardSyncStatus() {
  const context = useContext(BoardContext)
  if (!context)
    throw new Error('useBoardSyncStatus must be used within BoardProvider')
  return context.status
}

export { BoardProvider, useBoardDispatch, useBoardState, useBoardSyncStatus }
