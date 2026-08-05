import * as React from "react"

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={`rounded-xl border text-card-foreground shadow-xl ${className || ''}`}
        style={{
            borderColor: 'var(--color-border, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'var(--color-surface, rgba(36, 31, 25, 0.3))',
            backdropFilter: 'blur(var(--blur-xl))',
            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.2)'
        }}
        {...props}
    />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={`flex flex-col space-y-1.5 p-6 ${className || ''}`}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={`font-semibold leading-none tracking-tight ${className || ''}`}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={`p-6 pt-0 ${className || ''}`} {...props} />
))
CardContent.displayName = "CardContent"

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={`text-sm text-muted-foreground ${className || ''}`}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={`flex items-center p-6 pt-0 ${className || ''}`}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
