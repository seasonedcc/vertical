import type { ComponentProps } from 'react'
import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import type { Layer, Slice } from '~/state/types'
import { CheckIcon } from './check-icon'

type Props = {
  slice: Slice | undefined
  layers: Layer[]
} & ComponentProps<'div'>

const SliceWrapper = forwardRef<HTMLDivElement, Props>(
  ({ children, slice, layers, ...props }, ref) => {
    const sliceLayers = layers.filter((layer) => layer.sliceId === slice?.id)
    const allLayersDone =
      sliceLayers.length > 0 &&
      sliceLayers.every((layer) => layer.status === 'done')

    return (
      <div
        {...props}
        data-slice-wrapper={slice?.id}
        ref={ref}
        className={twMerge(
          'relative isolate flex min-h-[calc((100dvh-112px)/3)] flex-1 flex-col gap-1 bg-white py-3 transition-all duration-200',
          allLayersDone && 'border-transparent',
          props.className
        )}
      >
        {children}
        {allLayersDone && (
          <div className="-z-10 absolute inset-0 flex items-center justify-center">
            <CheckIcon
              className={twMerge('h-36 w-36 text-gray-300 opacity-60')}
            />
          </div>
        )}
      </div>
    )
  }
)

export { SliceWrapper }
