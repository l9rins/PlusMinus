import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// F1 pure snappy physics
const TWEEN_FAST = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.25 };
const SPRING_SNAPPY = { type: "spring", stiffness: 800, damping: 35, mass: 0.5 };

export function MagneticButton({ children, className, strength = 0.15, ...props }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * strength, y: middleY * strength });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      whileTap={{ scale: 0.96 }}
      transition={isHovered ? { type: "spring", stiffness: 400, damping: 25 } : SPRING_SNAPPY}
      className={cn(
        "relative overflow-hidden font-medium transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      {/* Burst effect layer */}
      <motion.div
        className="absolute inset-0 bg-white mix-blend-overlay"
        initial={{ opacity: 0, scale: 0 }}
        whileTap={{ opacity: 0.3, scale: 2 }}
        transition={{ duration: 0.4 }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
