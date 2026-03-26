import React, { createContext, useContext, useState, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const MorphingDialogContext = createContext(null);

const TWEEN_FAST = { type: "spring", stiffness: 300, damping: 30, mass: 1 };
const EASE_LOCK = [0.16, 1, 0.3, 1];

export function MorphingDialog({ children, transition }) {
  const [isOpen, setIsOpen] = useState(false);
  const uniqueId = useId();
  return (
    <MorphingDialogContext.Provider value={{ isOpen, setIsOpen, uniqueId, transition }}>
      {children}
    </MorphingDialogContext.Provider>
  );
}

export function MorphingDialogTrigger({ children, className }) {
  const { setIsOpen, uniqueId } = useContext(MorphingDialogContext);
  return (
    <motion.div
        layoutId={`dialog-${uniqueId}`}
        onClick={() => setIsOpen(true)}
        className={cn("cursor-pointer", className)}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
    >
        {children}
    </motion.div>
  );
}

export function MorphingDialogContainer({ children }) {
  const { isOpen, setIsOpen } = useContext(MorphingDialogContext);
  
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 isolate">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-pitch-900/80 backdrop-blur-sm -z-10"
                onClick={() => setIsOpen(false)}
            />
            {children}
        </div>
      )}
    </AnimatePresence>
  );
}

export function MorphingDialogContent({ children, className }) {
  const { uniqueId, transition } = useContext(MorphingDialogContext);
  return (
    <motion.div
      layoutId={`dialog-${uniqueId}`}
      transition={transition || { type: "tween", ease: EASE_LOCK, duration: 0.4 }}
      className={cn("relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-md bg-pitch-850 shadow-2xl border border-pitch-600/50 flex flex-col", className)}
    >
      {children}
    </motion.div>
  );
}

export function MorphingDialogClose({ className }) {
  const { setIsOpen } = useContext(MorphingDialogContext);
  return (
    <button
      onClick={() => setIsOpen(false)}
      className={cn("absolute top-4 right-4 z-20 p-1.5 rounded bg-pitch-800/80 text-pitch-400 hover:text-pitch-100 border border-pitch-700 hover:border-pitch-500 transition-colors", className)}
    >
      <X size={14} />
    </button>
  );
}
