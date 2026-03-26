import * as React from "react"
import { cn } from "@/lib/utils"

const Skeleton = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-morphin-ghost", className)}
      {...props}
    />
  )
}

export { Skeleton }
