import { type HTMLProps, forwardRef } from 'react'
import { cn } from '~/rich-text-editor/utils'

const Surface = forwardRef<
  HTMLDivElement,
  HTMLProps<HTMLDivElement> & {
    withShadow?: boolean
    withBorder?: boolean
  }
>(
  (
    { children, className, withShadow = true, withBorder = true, ...props },
    ref
  ) => {
    const surfaceClass = cn(
      className,
      'bg-white rounded-lg dark:bg-black',
      withShadow ? 'shadow-xs' : '',
      withBorder ? 'border border-neutral-200 dark:border-neutral-800' : ''
    )

    return (
      <div className={surfaceClass} {...props} ref={ref}>
        {children}
      </div>
    )
  }
)

Surface.displayName = 'Surface'

export { Surface }
