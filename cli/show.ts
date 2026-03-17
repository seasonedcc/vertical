import { sortBy } from '~/lib/utils'
import type { BoardState } from '~/state/types'

function showBoard(state: BoardState, boxId?: string) {
  const { project, slices, layers, tasks } = state
  const sortedSlices = sortBy(slices, 'boxNumber')
  const filteredSlices = boxId
    ? sortedSlices.filter((s) => s.id === boxId)
    : sortedSlices

  console.log(`Project: ${project.name} (id: ${project.id})`)
  console.log()

  for (const slice of filteredSlices) {
    const sliceName = slice.name || '(untitled)'
    console.log(`Box ${slice.boxNumber}: ${sliceName} (id: ${slice.id})`)

    const sliceLayers = sortBy(
      layers.filter((l) => l.sliceId === slice.id),
      'sorting'
    )

    for (const layer of sliceLayers) {
      const layerName = layer.name || '(unnamed)'
      const statusTag = layer.status === 'done' ? ' [done]' : ''
      const layerLabel =
        sliceLayers.length > 1 ? `Layer: ${layerName}` : 'Layer'
      console.log(`  ${layerLabel} (id: ${layer.id})${statusTag}`)

      const layerTasks = sortBy(
        tasks.filter((t) => t.layerId === layer.id),
        'sorting'
      )

      if (layerTasks.length === 0) {
        console.log('    (no tasks)')
      } else {
        for (const task of layerTasks) {
          const check = task.done ? 'x' : ' '
          const notesTag = task.notesHtml ? ' [notes]' : ''
          console.log(`    [${check}] ${task.name}${notesTag} (id: ${task.id})`)
        }
      }
    }

    console.log()
  }
}

function showBoardJson(state: BoardState) {
  const sorted = {
    ...state,
    slices: sortBy(state.slices, 'boxNumber'),
  }
  console.log(JSON.stringify(sorted, null, 2))
}

export { showBoard, showBoardJson }
