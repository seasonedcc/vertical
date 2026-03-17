import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  EllipsisVertical,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Pen,
  Pilcrow,
  Quote,
  Strikethrough,
  Subscript,
  Superscript,
  Trash2,
  Underline,
} from 'lucide-react'
import { memo } from 'react'
import { cn } from '~/rich-text-editor/utils'

const iconMap = {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  EllipsisVertical,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Pen,
  Pilcrow,
  Quote,
  Strikethrough,
  Subscript,
  Superscript,
  Trash2,
  Underline,
} as const

const Icon = memo(
  ({
    name,
    className,
    strokeWidth,
  }: {
    name: string
    className?: string
    strokeWidth?: number
  }) => {
    const IconComponent = iconMap[name as keyof typeof iconMap]

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
