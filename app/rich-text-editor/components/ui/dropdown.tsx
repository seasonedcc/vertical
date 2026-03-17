import React from 'react'
import { cn } from '~/rich-text-editor/utils'

const DropdownCategoryTitle = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <div className="mb-1 px-1.5 font-semibold text-[.65rem] text-neutral-500 uppercase dark:text-neutral-400">
      {children}
    </div>
  )
}

const DropdownButton = React.forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode
    isActive?: boolean
    onClick?: () => void
    disabled?: boolean
    className?: string
  }
>(function DropdownButtonInner(
  { children, isActive, onClick, disabled, className },
  ref
) {
  const buttonClass = cn(
    'flex items-center gap-2 p-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 text-left bg-transparent w-full rounded',
    !isActive && !disabled,
    'hover:bg-neutral-50 dark:hover:bg-neutral-900',
    isActive &&
      !disabled &&
      'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
    disabled && 'text-neutral-400 cursor-not-allowed dark:text-neutral-600',
    className
  )

  return (
    <button
      className={buttonClass}
      disabled={disabled}
      onClick={onClick}
      ref={ref}
    >
      {children}
    </button>
  )
})

export { DropdownCategoryTitle, DropdownButton }
