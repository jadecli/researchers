"use client";

import { motion } from "motion/react";
import Link from "next/link";

interface ScrapyPageProps {
  breadcrumb: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  prev?: { label: string; href: string };
  next?: { label: string; href: string };
}

export function ScrapyPage({ breadcrumb, title, subtitle, children, prev, next }: ScrapyPageProps) {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 text-xs text-[#6b6961] mb-3">
          <Link href="/scrapy" className="hover:text-[#d97757]">Scrapy</Link>
          <span>/</span>
          <span className="text-[#b0aea5]">{breadcrumb}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5] mb-3">{title}</h1>
        <p className="text-[#b0aea5] text-base leading-relaxed">{subtitle}</p>
      </motion.div>

      {children}

      {(prev || next) && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between pt-4 border-t border-[#2a2a28] text-xs"
        >
          {prev ? (
            <Link href={prev.href} className="text-[#b0aea5] hover:text-[#d97757]">
              ← {prev.label}
            </Link>
          ) : <span />}
          {next ? (
            <Link href={next.href} className="text-[#b0aea5] hover:text-[#d97757]">
              {next.label} →
            </Link>
          ) : <span />}
        </motion.div>
      )}
    </div>
  );
}
