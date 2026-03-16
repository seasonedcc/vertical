import { useRef, useState } from 'react'
import { cx } from '~/lib/utils'
import { useBoardDispatch, useBoardState } from '~/state/context'
import type { Layer, Task } from '~/state/types'
import { AddTaskForm } from './add-task-form'
import { EditableTask } from './editable-task'
import { useProjectMode } from './project-mode'

function TaskItem({
  task,
  index,
  variant,
  onDeleted,
  onTaskCreatedAfter,
}: {
  task: Task
  index: number
  variant: 'mobile' | 'desktop'
  onDeleted: (index: number) => void
  onTaskCreatedAfter: (index: number) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const { projectMode, setProjectMode } = useProjectMode()
  const dispatch = useBoardDispatch()
  const { layers } = useBoardState()

  return (
    <div
      {...(projectMode === 'split'
        ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          }
        : {})}
      onClick={(event) => {
        if (projectMode !== 'split') {
          return
        }
        event.stopPropagation()
        setProjectMode('default')

        const currentLayer = layers.find((l) => l.id === task.layerId)
        if (!currentLayer) return

        const nextLayer = layers
          .filter(
            (l) =>
              l.sliceId === currentLayer.sliceId &&
              l.sorting > currentLayer.sorting
          )
          .sort((a, b) => a.sorting - b.sorting)[0]

        const newLayerSorting = nextLayer
          ? (currentLayer.sorting + nextLayer.sorting) / 2
          : currentLayer.sorting + 1

        dispatch({
          type: 'SPLIT_LAYER',
          taskId: task.id,
          newLayerId: crypto.randomUUID(),
          currentLayerId: task.layerId,
          sliceId: currentLayer.sliceId,
          taskSorting: task.sorting,
          newLayerSorting,
        })
      }}
    >
      <div className={cx('flex gap-1', variant === 'desktop' && 'group/task')}>
        <EditableTask
          variant={variant}
          index={index}
          onDeleted={onDeleted}
          onTaskCreatedAfter={onTaskCreatedAfter}
          task={task}
        />
      </div>
      {projectMode === 'split' && isHovered && (
        <hr className="-ml-4 -mr-16 my-4 border-base-content/10 border-dashed" />
      )}
    </div>
  )
}

function TaskList({
  tasks,
  layer,
  variant,
}: {
  tasks: Task[]
  layer: Layer
  variant: 'mobile' | 'desktop'
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  function handleTaskDeleted(index: number) {
    const getItem = (index: number) =>
      wrapperRef.current?.querySelector<HTMLButtonElement>(
        `[data-task-index="${index}"]`
      )
    const fallbackItem =
      getItem(index + 1) ??
      getItem(index - 1) ??
      wrapperRef.current?.querySelector<HTMLInputElement>('input')

    fallbackItem?.focus()
  }

  function handleTaskCreatedAfter(index: number) {
    setTimeout(() => {
      const newTaskButton =
        wrapperRef.current?.querySelector<HTMLButtonElement>(
          `[data-task-index="${index + 1}"]`
        )
      newTaskButton?.click()
    }, 0)
  }

  return (
    <div className="relative flex flex-1 flex-col px-4" ref={wrapperRef}>
      {tasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          index={index}
          variant={variant}
          onDeleted={handleTaskDeleted}
          onTaskCreatedAfter={handleTaskCreatedAfter}
        />
      ))}
      <AddTaskForm layer={layer} tasks={tasks} variant={variant} />
    </div>
  )
}

export { TaskList }
