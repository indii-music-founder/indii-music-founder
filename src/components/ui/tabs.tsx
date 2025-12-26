import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

// Since we might not have radix-ui installed, we'll build a simple custom one if needed.
// But assuming a standard React setup, let's try a simple state-based implementation without Radix for safety if deps are missing,
// OR check package.json first. 
// For speed and safety given "Alpha" status, I'll build a self-contained accessible Tabs component
// to avoid "module not found" for radix.

interface TabsProps {
    defaultValue: string;
    className?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
}

const TabsContext = React.createContext<{
    value: string;
    setValue: (v: string) => void;
} | null>(null);

export const Tabs = ({ defaultValue, className, onValueChange, children }: TabsProps) => {
    const [value, setValue] = React.useState(defaultValue);
    const handleValueChange = (newValue: string) => {
        setValue(newValue);
        onValueChange?.(newValue);
    };

    return (
        <TabsContext.Provider value={{ value, setValue: handleValueChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
};

export const TabsList = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={`inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground ${className || ''}`}>
        {children}
    </div>
);

export const TabsTrigger = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used within Tabs");

    const isSelected = context.value === value;

    return (
        <button
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${isSelected ? 'bg-background text-foreground shadow' : ''} ${className || ''}`}
            onClick={() => context.setValue(value)}
            type="button"
        >
            {children}
        </button>
    );
};

export const TabsContent = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used within Tabs");

    if (context.value !== value) return null;

    return (
        <div className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className || ''}`}>
            {children}
        </div>
    );
};
