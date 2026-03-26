import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[1.5px] tabular-nums transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-pitch-600/50 bg-pitch-800 text-pitch-300",
        win:
          "border-win/25 bg-win/8 text-win",
        loss:
          "border-loss/25 bg-loss/8 text-loss",
        draw:
          "border-draw/25 bg-draw/8 text-draw",
        accent:
          "border-accent/25 bg-accent/8 text-accent",
        elite:
          "border-tier-elite/30 bg-tier-elite/8 text-tier-elite",
        good:
          "border-tier-good/30 bg-tier-good/8 text-tier-good",
        avg:
          "border-tier-avg/30 bg-tier-avg/8 text-tier-avg",
        poor:
          "border-tier-poor/30 bg-tier-poor/8 text-tier-poor",
        bad:
          "border-tier-bad/30 bg-tier-bad/8 text-tier-bad",
        live:
          "border-win/25 bg-win/8 text-win gap-1",
        outline:
          "border-pitch-600 text-pitch-400",
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
