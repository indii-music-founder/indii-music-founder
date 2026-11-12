import * as React from "react"

const ScrollArea = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
    <div
        ref={ref}
        className={`relative min-w-0 min-h-0 overflow-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${className || ''}`}
        {...props}
    >
        {children}
    </div>
))
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
