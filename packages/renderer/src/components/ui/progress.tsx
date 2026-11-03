import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, max, indicatorClassName, ...props }, ref) => {
    const safeMax = typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : 100
    const safeValue = typeof value === 'number' && Number.isFinite(value)
        ? Math.min(safeMax, Math.max(0, value))
        : null
    const percentage = safeValue === null ? 0 : safeValue / safeMax * 100

    return <ProgressPrimitive.Root
        ref={ref}
        value={safeValue}
        max={safeMax}
        className={cn(
            "relative h-2 w-full overflow-hidden rounded-full bg-white/10",
            className
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className={cn("h-full w-full flex-1 bg-green-500 transition-all", indicatorClassName)}
            style={{ transform: `translateX(${percentage === 100 ? 0 : percentage - 100}%)` }}
        />
    </ProgressPrimitive.Root>
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
