import * as Select from '@radix-ui/react-select'
import { MoreHorizontal } from 'lucide-react'
import { cx } from '~/lib/utils'
import { useBoardDispatch } from '~/state/context'
import type { Layer } from '~/state/types'

const layerStatuses = ['done'] as const

function StatusSelect({
  layer,
  className,
}: {
  layer: Layer
  className?: string
}) {
  const dispatch = useBoardDispatch()

  function onChange(value: string) {
    const status = value === '—' ? null : (value as 'done' | null)
    dispatch({ type: 'SET_LAYER_STATUS', layerId: layer.id, status })
  }

  return (
    <Select.Root value={layer.status || '-'} onValueChange={onChange}>
      <Select.Trigger
        tabIndex={0}
        className={cx(
          'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent bg-transparent text-base-content/60 opacity-0 transition-opacity focus:border-black/10 focus:opacity-100 focus:outline-hidden active:border-transparent group-hover:opacity-100 data-[state=open]:opacity-100',
          className
        )}
        aria-label="Select status"
        onPointerDown={(event) => {
          event.preventDefault()
        }}
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <Select.Value>
          <MoreHorizontal className="h-4 w-4" />
        </Select.Value>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          className="z-10 w-40 rounded bg-base-100 shadow-xs focus:outline-hidden"
        >
          <Select.Viewport>
            <Select.Item
              value="—"
              className="relative flex cursor-pointer justify-between gap-1 px-2 py-0.5 first:rounded-t last:rounded-b focus:outline-hidden data-[highlighted]:bg-base-200"
            >
              <Select.ItemText>—</Select.ItemText>
              <Select.ItemIndicator>
                <span aria-hidden> ✓</span>
              </Select.ItemIndicator>
            </Select.Item>
            {layerStatuses.map((option) => (
              <Select.Item
                key={option}
                value={option}
                className="relative flex cursor-pointer justify-between gap-1 px-2 py-0.5 first:rounded-t last:rounded-b focus:outline-hidden data-[highlighted]:bg-base-200"
              >
                <Select.ItemText>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Select.ItemText>
                <Select.ItemIndicator>
                  <span aria-hidden> ✓</span>
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

export { StatusSelect }
