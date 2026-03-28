export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[#252524] text-[#d97757] px-1.5 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  );
}
