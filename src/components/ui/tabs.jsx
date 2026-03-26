import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-[var(--neon-raised)] border border-[var(--neon-border)] p-1 text-[var(--neon-muted)]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-sans font-semibold tracking-wide uppercase transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-green-border)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--neon-raised)]",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-[var(--neon-muted)] hover:text-[var(--neon-text)] hover:bg-[var(--neon-overlay)]",
      "data-[state=active]:bg-[var(--neon-green-faint)] data-[state=active]:text-[var(--neon-green)] data-[state=active]:border data-[state=active]:border-[var(--neon-green-border)]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-green-border)] focus-visible:ring-offset-1",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
