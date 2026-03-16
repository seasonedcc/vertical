import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
} from 'react'
import { serialize } from '~/file/format'
import type { BoardAction } from './actions'
import { boardReducer } from './reducer'
import type { BoardState } from './types'

type BoardContextValue = {
  state: BoardState
  dispatch: (action: BoardAction) => void
  isDirty: () => boolean
  markClean: () => void
}

const BoardContext = createContext<BoardContextValue | undefined>(undefined)

function BoardProvider({
  initialState,
  children,
}: {
  initialState: BoardState
  children: React.ReactNode
}) {
  const [state, rawDispatch] = useReducer(boardReducer, initialState)
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    serialize(initialState)
  )

  const dispatch = useCallback((action: BoardAction) => {
    rawDispatch(action)
    if (action.type === 'LOAD_STATE') {
      setSavedSnapshot(serialize(action.state))
    }
  }, [])

  const currentSnapshot = useMemo(() => serialize(state), [state])
  const isDirty = useCallback(
    () => currentSnapshot !== savedSnapshot,
    [currentSnapshot, savedSnapshot]
  )
  const markClean = useCallback(() => {
    setSavedSnapshot(currentSnapshot)
  }, [currentSnapshot])

  return (
    <BoardContext.Provider value={{ state, dispatch, isDirty, markClean }}>
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

function useIsDirty() {
  const context = useContext(BoardContext)
  if (!context) throw new Error('useIsDirty must be used within BoardProvider')
  return context.isDirty
}

function useMarkClean() {
  const context = useContext(BoardContext)
  if (!context)
    throw new Error('useMarkClean must be used within BoardProvider')
  return context.markClean
}

export {
  BoardProvider,
  useBoardDispatch,
  useBoardState,
  useIsDirty,
  useMarkClean,
}
