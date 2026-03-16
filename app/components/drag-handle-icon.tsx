import type { Ref, SVGProps } from 'react'
import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

const DragHandleIcon = forwardRef(
  (
    { className, ...props }: SVGProps<SVGSVGElement>,
    ref: Ref<SVGSVGElement>
  ) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="none"
      viewBox="0 0 25 25"
      ref={ref}
      className={twMerge(
        '-ml-1 h-5 w-5 shrink-0 cursor-move rounded border-2 border-transparent text-base-content/70 focus:border-neutral-content focus:outline-hidden active:border-transparent',
        className
      )}
      {...props}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M9.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm1.5 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm1.5 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        clipRule="evenodd"
      />
    </svg>
  )
)

export { DragHandleIcon }
