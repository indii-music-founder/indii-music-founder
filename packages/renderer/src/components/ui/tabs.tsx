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
>(({ className, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onKeyDown) {
            onKeyDown(e)
        }
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return

        const list = e.currentTarget
        const tabs = Array.from(list.querySelectorAll('[role="tab"]:not([disabled]):not([aria-disabled="true"])')) as HTMLElement[]
        const ownTabs = tabs.filter(tab => tab.closest('[role="tablist"]') === list && !tab.closest('[hidden], [inert]'))
        const index = ownTabs.indexOf(list.ownerDocument.activeElement as HTMLElement)

        if (index === -1) return

        const rightStep = list.ownerDocument.defaultView?.getComputedStyle(list).direction === "rtl" ? -1 : 1
        let nextIndex = index

        const vertical = list.getAttribute("aria-orientation") === "vertical"
        switch (e.key) {
            case "ArrowDown":
            case "ArrowRight":
                if (vertical !== (e.key === "ArrowDown")) return
                nextIndex = (index + (vertical ? 1 : rightStep) + ownTabs.length) % ownTabs.length
                break
            case "ArrowUp":
            case "ArrowLeft":
                if (vertical !== (e.key === "ArrowUp")) return
                nextIndex = (index - (vertical ? 1 : rightStep) + ownTabs.length) % ownTabs.length
                break
            case "Home":
                nextIndex = 0
                break
            case "End":
                nextIndex = ownTabs.length - 1
                break
            default:
                return
        }

        e.preventDefault()
        const nextTab = ownTabs[nextIndex]!
        nextTab.focus()
        if (list.ownerDocument.activeElement === nextTab) nextTab.click()
    }

    return (
        <div
            ref={ref}
            role="tablist"
            onKeyDown={handleKeyDown}
            className={cn(
                "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
                className
            )}
            {...props}
        />
    )
})
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, onClick, disabled, tabIndex, "aria-disabled": ariaDisabled, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error("TabsTrigger must be used within Tabs")

    const isBlocked = disabled || ariaDisabled === true || ariaDisabled === "true"
    const isActive = context.activeTab === value
    const triggerId = `${context.baseId}-trigger-${value}`
    const contentId = `${context.baseId}-content-${value}`

    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isBlocked || undefined}
            aria-controls={contentId}
            id={triggerId}
            disabled={disabled}
            tabIndex={isBlocked ? -1 : tabIndex ?? (isActive ? 0 : -1)}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:bg-gray-800/50 hover:text-white",
                className
            )}
            onClick={(event) => {
                if (isBlocked) {
                    event.preventDefault()
                    event.stopPropagation()
                    return
                }
                onClick?.(event)
                if (!event.defaultPrevented) context.setActiveTab(value)
            }}
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
