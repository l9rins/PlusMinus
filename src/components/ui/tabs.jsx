import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-md bg-pitch-850 border border-pitch-700/50 p-0.5",
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
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3.5 py-1.5",
      "text-[11px] font-medium uppercase tracking-[1.5px] text-pitch-500",
      "transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
      "hover:text-pitch-300",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-pitch-750 data-[state=active]:text-pitch-50",
      "data-[state=active]:border data-[state=active]:border-pitch-600/50",
      "data-[state=active]:shadow-sm",
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
      "mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
