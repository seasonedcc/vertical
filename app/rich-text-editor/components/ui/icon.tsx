import { icons } from 'lucide-react'
import { memo } from 'react'
import { cn } from '~/rich-text-editor/utils'

const Icon = memo(
  ({
    name,
    className,
    strokeWidth,
  }: {
    name: keyof typeof icons
    className?: string
    strokeWidth?: number
  }) => {
    const IconComponent = icons[name]

    if (!IconComponent) {
      return null
    }

    return (
      <IconComponent
        className={cn('h-4 w-4', className)}
        strokeWidth={strokeWidth || 2.5}
      />
    )
  }
)

Icon.displayName = 'Icon'

export { Icon }
