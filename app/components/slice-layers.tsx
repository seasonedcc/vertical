import { Fragment } from 'react/jsx-runtime'
import { cx } from '~/lib/utils'
import { useBoardDispatch } from '~/state/context'
import type { Layer, Task } from '~/state/types'
import { SliceLayer } from './slice-layer'

function LayerSeparator({ layer }: { layer: Layer }) {
  const dispatch = useBoardDispatch()

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()
      dispatch({ type: 'UNSPLIT_LAYER', layerId: layer.id })
    }
  }

  return (
    <button
      type="button"
      className="group cursor-pointer px-6 py-3"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div>
        <hr className="border-base-content/20 border-t-2 border-dashed group-focus:border-primary" />
      </div>
    </button>
  )
}

function SliceLayers({
  layers,
  tasks,
  variant,
  allLayersDone,
}: {
  layers: Layer[]
  tasks: Task[]
  variant: 'mobile' | 'desktop'
  allLayersDone: boolean
}) {
  return (
    <div
      className={cx(
        'flex flex-col pt-1',
        variant === 'desktop' && 'flex-1',
        variant === 'mobile' && 'pb-8'
      )}
    >
      {layers.map((layer, index) => (
        <Fragment key={layer.id}>
          <SliceLayer
            layer={layer}
            tasks={tasks}
            layerIndex={index}
            totalLayers={layers.length}
            variant={variant}
            allLayersDone={allLayersDone}
          />
          {index < layers.length - 1 && <LayerSeparator layer={layer} />}
        </Fragment>
      ))}
    </div>
  )
}

export { SliceLayers }
