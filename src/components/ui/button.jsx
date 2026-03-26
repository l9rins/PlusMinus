import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium font-sans transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-green-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neon-bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--neon-green)] text-black hover:bg-[#00ffa8] shadow-sm",
        destructive:
          "bg-[#f43f5e] text-white hover:bg-[#f43f5e]/90",
        outline:
          "border border-[var(--neon-border-md)] bg-transparent text-[var(--neon-muted)] hover:bg-[var(--neon-raised)] hover:text-[var(--neon-text)]",
        secondary:
          "bg-[var(--neon-raised)] text-[var(--neon-text)] hover:bg-[var(--neon-overlay)]",
        ghost:
          "text-[var(--neon-muted)] hover:bg-[var(--neon-raised)] hover:text-[var(--neon-text)]",
        link:
          "text-[var(--neon-green)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
