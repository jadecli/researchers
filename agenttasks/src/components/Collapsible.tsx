"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accent?: string;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

export function Collapsible({
  title,
  defaultOpen = false,
  children,
  accent = "#d97757",
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between min-h-[44px] py-3 gap-3 text-left"
      >
        <span className="text-lg font-semibold text-[#faf9f5] flex items-center gap-2">
          <span style={{ color: accent }}>—</span>
          {title}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={spring}
          className="text-[#6b6961] text-sm shrink-0"
        >
          ▶
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-2 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
