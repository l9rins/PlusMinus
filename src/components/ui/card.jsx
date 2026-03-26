import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-[var(--neon-border)] bg-[var(--neon-surface)] text-[var(--neon-text)] transition-all duration-200 hover:border-[var(--neon-border-md)] hover:bg-[var(--neon-raised)]",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-sans text-lg font-semibold leading-none tracking-tight text-[var(--neon-text)]",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--neon-muted)]", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// NeonCard — dark glow variant (replaces CrystalCard for dark theme)
const NeonCard = React.forwardRef(({ className, children, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn(
      "border-[var(--neon-green-border)] shadow-[0_0_24px_var(--neon-green-faint)]",
      className
    )}
    {...props}
  >
    {children}
  </Card>
))
NeonCard.displayName = "NeonCard"

// Keep CrystalCard exported as an alias so existing imports don't break
const CrystalCard = NeonCard
CrystalCard.displayName = "CrystalCard"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, NeonCard, CrystalCard }
