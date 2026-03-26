// src/components/ui/premium-card.jsx
// PlusMinus · Neon Dark Edition
// Replaces the white Morphin card with Neon's dark surface system.
// API is identical — no changes needed in consumers.

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const PremiumCard = React.forwardRef(
  ({ className, children, hover = true, glow = false, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={
        hover
          ? { y: -2, borderColor: "rgba(255,255,255,0.14)" }
          : undefined
      }
      transition={{ duration: 0.18 }}
      className={cn(
        // Neon dark surface — replaces `bg-white border-morphin-border rounded-3xl`
        "rounded-xl border transition-colors",
        "bg-[var(--neon-surface)] border-[var(--neon-border)]",
        glow && "shadow-[0_0_24px_var(--neon-green-faint)] border-[var(--neon-green-border)]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
);
PremiumCard.displayName = "PremiumCard";

const PremiumCardHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1", className)} {...props} />
);

const PremiumCardTitle = ({ className, ...props }) => (
  <h3
    className={cn(
      "font-sans text-base font-bold leading-none tracking-tight text-[var(--neon-text)]",
      className
    )}
    {...props}
  />
);

const PremiumCardDescription = ({ className, ...props }) => (
  <p
    className={cn(
      "text-xs text-[var(--neon-muted)] font-sans",
      className
    )}
    {...props}
  />
);

const PremiumCardContent = ({ className, ...props }) => (
  <div className={cn("pt-4", className)} {...props} />
);

const PremiumCardFooter = ({ className, ...props }) => (
  <div className={cn("flex items-center pt-4", className)} {...props} />
);

export {
  PremiumCard,
  PremiumCardHeader,
  PremiumCardFooter,
  PremiumCardTitle,
  PremiumCardDescription,
  PremiumCardContent,
};