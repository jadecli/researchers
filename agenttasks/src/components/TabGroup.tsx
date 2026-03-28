"use client";

import { useState, useId } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Tab {
  label: string;
  content: React.ReactNode;
}

interface TabGroupProps {
  tabs: Tab[];
  defaultIndex?: number;
}

export function TabGroup({ tabs, defaultIndex = 0 }: TabGroupProps) {
  const id = useId();
  const [active, setActive] = useState(defaultIndex);
  const [direction, setDirection] = useState(1);

  const handleTabChange = (index: number) => {
    setDirection(index > active ? 1 : -1);
    setActive(index);
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl p-1 flex gap-0 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => handleTabChange(i)}
            className={`relative min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-1 ${
              active === i
                ? "text-[#faf9f5]"
                : "text-[#6b6961] hover:text-[#b0aea5]"
            }`}
          >
            {active === i && (
              <motion.div
                layoutId={id + "-indicator"}
                className="absolute inset-0 bg-[#252524] rounded-lg"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, x: direction > 0 ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {tabs[active].content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
