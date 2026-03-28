"use client";

import { useState } from "react";
import { motion } from "motion/react";

interface CodeBlockProps {
  language: string;
  children: string;
  title?: string;
}

export function CodeBlock({ language, children, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="bg-[#1c1c1b] border border-[#2a2a28] rounded-xl overflow-hidden"
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="bg-[#252524] flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider font-mono text-[#6b6961] bg-[#1c1c1b] px-2 py-0.5 rounded">
            {language}
          </span>
          {title && (
            <span className="text-xs text-[#b0aea5]">{title}</span>
          )}
        </div>
        <button
          onClick={copy}
          className="text-[#6b6961] hover:text-[#faf9f5] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-xs"
          aria-label="Copy code"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre
        className="p-4 text-sm font-mono text-[#b0aea5] overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </pre>
    </motion.div>
  );
}
