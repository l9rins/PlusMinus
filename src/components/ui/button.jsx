import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-morphin-accent text-morphin-base hover:bg-morphin-accent/90 shadow-sm",
        destructive:
          "bg-loss text-white hover:bg-loss/90",
        outline:
          "border border-morphin-border bg-morphin-base hover:bg-morphin-ghost hover:text-morphin-text",
        secondary:
          "bg-morphin-ghost text-morphin-text hover:bg-morphin-ghost/80",
        ghost: "hover:bg-morphin-ghost hover:text-morphin-text",
        link: "text-morphin-accent underline-offset-4 hover:underline",
        crystal: "bg-white/40 backdrop-blur-md border border-white/40 text-morphin-text hover:bg-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.03)]",
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
