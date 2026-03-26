import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold font-sans uppercase tracking-[1.5px] tabular-nums transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-[var(--neon-border-md)] bg-[var(--neon-raised)] text-[var(--neon-muted)]",
        win:
          "border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.08)] text-[#34d399]",
        loss:
          "border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.08)] text-[#f87171]",
        accent:
          "border-[var(--neon-green-border)] bg-[var(--neon-green-faint)] text-[var(--neon-green)]",
        outline:
          "border-[var(--neon-border-md)] text-[var(--neon-muted)] bg-transparent",
        live:
          "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[#f87171]",
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
