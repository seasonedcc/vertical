import { DragOverlay } from '@dnd-kit/react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function BoardDragOverlay({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(<DragOverlay>{children}</DragOverlay>, document.body)
}

export { BoardDragOverlay }
