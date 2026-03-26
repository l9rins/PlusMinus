import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-[var(--neon-border-md)] bg-[var(--neon-raised)] px-3 py-2 text-sm font-sans text-[var(--neon-text)] placeholder:text-[var(--neon-dim)]",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-green-border)] focus-visible:border-[var(--neon-green-border)]",
        "disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
