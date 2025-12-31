import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'onChange'> {
    defaultValue?: number[]
    max?: number
    step?: number
    onChange?: (value: number[]) => void
    onValueChange?: (value: number[]) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, defaultValue, max = 100, step = 1, onChange, onValueChange, ...props }, ref) => {
        // Adapter for array-based value to single input
        const [value, setValue] = React.useState(defaultValue ? defaultValue[0] : 0)

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newVal = parseFloat(e.target.value)
            setValue(newVal)
            if (onChange) onChange([newVal])
            if (onValueChange) onValueChange([newVal])
        }

        return (
            <input
                type="range"
                className={cn(
                    "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary",
                    className
                )}
                min={0}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                ref={ref}
                {...props}
            />
        )
    }
)
Slider.displayName = "Slider"

export { Slider }
