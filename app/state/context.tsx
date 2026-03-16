import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
} from 'react'
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
  const dirtyRef = useRef(false)

  const dispatch = useCallback((action: BoardAction) => {
    rawDispatch(action)
    if (action.type !== 'LOAD_STATE') {
      dirtyRef.current = true
    }
  }, [])

  const isDirty = useCallback(() => dirtyRef.current, [])
  const markClean = useCallback(() => {
    dirtyRef.current = false
  }, [])

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
