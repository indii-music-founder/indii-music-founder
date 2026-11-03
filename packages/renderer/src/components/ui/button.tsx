import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { Slot } from "@radix-ui/react-slot"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    size?: "default" | "sm" | "lg" | "icon"
    asChild?: boolean
    isLoading?: boolean
}

// Bolt Optimization: Wrapped in React.memo to prevent unnecessary re-renders.
// This is beneficial when the Button is used in lists or forms where parent state changes
// (like input values) would otherwise trigger a re-render of the Button even if its props
// (variant, size, disabled, children) remain referentially stable.
const Button = React.memo(React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
        // Simplified variant mapping without class-variance-authority
        const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

        const variants = {
            default: "bg-primary text-primary-foreground hover:bg-primary/90",
            destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground",
            link: "text-primary underline-offset-4 hover:underline",
        }

        const sizes = {
            default: "h-10 px-4 py-2",
            sm: "h-9 rounded-md px-3",
            lg: "h-11 rounded-md px-8",
            icon: "h-10 w-10",
        }

        const isBlocked = disabled || isLoading
        if (asChild && isBlocked) {
            const child = React.Children.only(children)
            if (!React.isValidElement<React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement> & { href?: string; disabled?: boolean; 'data-loading'?: boolean }>(child)) {
                throw new Error("Button asChild requires one element")
            }
            const childProps = child.props
            return React.cloneElement(child, {
                ...props,
                ref: (node: HTMLElement | null) => {
                    for (const target of [(child as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref, ref as React.Ref<HTMLElement>]) {
                        if (typeof target === 'function') target(node)
                        else if (target && typeof target !== 'string') (target as React.MutableRefObject<HTMLElement | null>).current = node
                    }
                },
                className: cn(baseStyles, variants[variant], sizes[size], childProps.className, className),
                'aria-disabled': true,
                'data-loading': isLoading,
                tabIndex: -1,
                href: undefined,
                disabled: typeof child.type === 'string' && child.type === 'button' ? true : undefined,
                onClick: (event: React.MouseEvent<HTMLElement>) => {
                    event.preventDefault()
                    event.stopPropagation()
                },
                onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
                    event.preventDefault()
                    event.stopPropagation()
                },
                onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                    }
                },
                onKeyDownCapture: (event: React.KeyboardEvent<HTMLElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                    }
                },
            })
        }

        const Comp = asChild ? Slot : "button"

        return (
            <Comp
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                ref={ref}
                {...(asChild ? {} : { disabled: isBlocked })}
                aria-disabled={isBlocked}
                data-loading={isLoading}
                {...props}
            >
                {asChild ? children : (
                    <>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {children}
                    </>
                )}
            </Comp>
        )
    }
))
Button.displayName = "Button"

export { Button }
