import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type ProjectMode = 'default' | 'split'

type ProjectModeContextValue = {
  projectMode: ProjectMode
  setProjectMode: (mode: ProjectMode) => void
}

const ProjectModeContext = createContext<ProjectModeContextValue | undefined>(
  undefined
)

function ProjectModeProvider({ children }: { children: ReactNode }) {
  const [projectMode, setProjectMode] = useState<ProjectMode>('default')

  return (
    <ProjectModeContext.Provider value={{ projectMode, setProjectMode }}>
      {children}
    </ProjectModeContext.Provider>
  )
}

function useProjectMode() {
  const context = useContext(ProjectModeContext)
  if (!context) {
    throw new Error('useProjectMode must be used within ProjectModeProvider')
  }
  return context
}

export { ProjectModeProvider, useProjectMode }
export type { ProjectMode }
