import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[1.5px] tabular-nums transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-morphin-border bg-morphin-ghost text-morphin-muted uppercase tracking-[1.2px]",
        win:
          "border-win/20 bg-win/8 text-win uppercase tracking-[1.2px]",
        loss:
          "border-loss/20 bg-loss/8 text-loss uppercase tracking-[1.2px]",
        accent:
          "border-morphin-accent/20 bg-morphin-accent/8 text-morphin-accent uppercase tracking-[1.2px]",
        outline:
          "border-morphin-border text-morphin-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
