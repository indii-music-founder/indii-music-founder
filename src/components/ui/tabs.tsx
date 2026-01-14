import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
    activeTab: string
    setActiveTab: (value: string) => void
    baseId: string
} | null>(null)

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
    defaultValue?: string
    value?: string
    onValueChange?: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
    ({ className, defaultValue, value: controlledValue, onValueChange, children, ...props }, ref) => {
        const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
        const isControlled = controlledValue !== undefined
        const activeTab = (isControlled ? controlledValue : uncontrolledValue) ?? ""
        const baseId = React.useId()

        const setActiveTab = React.useCallback(
            (value: string) => {
                if (!isControlled) {
                    setUncontrolledValue(value)
                }
                onValueChange?.(value)
            },
            [isControlled, onValueChange]
        )

        return (
            <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
                <div ref={ref} className={cn("", className)} {...props}>
                    {children}
                </div>
            </TabsContext.Provider>
        )
    }
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        role="tablist"
        className={cn(
            "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
            className
        )}
        {...props}
    />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error("TabsTrigger must be used within Tabs")

    const isActive = context.activeTab === value
    const triggerId = `${context.baseId}-trigger-${value}`
    const contentId = `${context.baseId}-content-${value}`

    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={contentId}
            id={triggerId}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:bg-gray-800/50 hover:text-white",
                className
            )}
            onClick={() => context.setActiveTab(value)}
            data-state={isActive ? "active" : "inactive"}
            {...props}
        />
    )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, children, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error("TabsContent must be used within Tabs")

    if (context.activeTab !== value) return null

    const triggerId = `${context.baseId}-trigger-${value}`
    const contentId = `${context.baseId}-content-${value}`

    return (
        <div
            ref={ref}
            role="tabpanel"
            id={contentId}
            aria-labelledby={triggerId}
            tabIndex={0}
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
