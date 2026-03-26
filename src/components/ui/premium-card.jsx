import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const PremiumCard = React.forwardRef(({ className, children, hover = true, ...props }, ref) => (
  <motion.div
    ref={ref}
    whileHover={hover ? { y: -4, shadow: "0 20px 40px rgba(0,0,0,0.04)" } : undefined}
    className={cn(
      "rounded-3xl border border-morphin-border bg-white p-6 transition-colors shadow-sm",
      className
    )}
    {...props}
  >
    {children}
  </motion.div>
));
PremiumCard.displayName = "PremiumCard";

const PremiumCardHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5", className)} {...props} />
);

const PremiumCardTitle = ({ className, ...props }) => (
  <h3 className={cn("font-display text-lg font-bold leading-none tracking-tight text-morphin-text", className)} {...props} />
);

const PremiumCardDescription = ({ className, ...props }) => (
  <p className={cn("text-xs text-morphin-muted font-medium", className)} {...props} />
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
  PremiumCardContent 
};
