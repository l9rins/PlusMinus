import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function MorphingDialog({ trigger, content, layoutId, triggerClassName }) {
  const [isOpen, setIsOpen] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // F1 crisp mechanical tween
  const TWEEN_FAST = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.35 };

  return (
    <>
      <motion.div
        layoutId={layoutId}
        onClick={() => setIsOpen(true)}
        className={triggerClassName}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={TWEEN_FAST}
      >
        {trigger}
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 isolate">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-pitch-900/80 backdrop-blur-sm -z-10"
            />
            <motion.div
              layoutId={layoutId}
              transition={TWEEN_FAST}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-md bg-pitch-850 shadow-2xl border border-pitch-600/50 flex flex-col"
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-20 p-1.5 rounded bg-pitch-800/80 text-pitch-400 hover:text-pitch-100 border border-pitch-700 hover:border-pitch-500 transition-colors"
              >
                <X size={14} />
              </button>
              {content({ close: () => setIsOpen(false) })}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
