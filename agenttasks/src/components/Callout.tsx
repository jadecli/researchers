interface CalloutProps {
  type: "tip" | "note" | "warning";
  children: React.ReactNode;
}

const config = {
  tip: { color: "#788c5d", icon: "✓", label: "Tip" },
  note: { color: "#6a9bcc", icon: "ℹ", label: "Note" },
  warning: { color: "#d97757", icon: "⚠", label: "Warning" },
};

export function Callout({ type, children }: CalloutProps) {
  const { color, icon, label } = config[type];
  return (
    <div
      className="flex gap-3 p-4 rounded-xl"
      style={{
        borderLeft: `4px solid ${color}`,
        backgroundColor: `${color}0d`,
      }}
    >
      <span className="shrink-0 mt-0.5" style={{ color }} aria-hidden>
        {icon}
      </span>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <div className="text-sm text-[#b0aea5] leading-relaxed mt-1">
          {children}
        </div>
      </div>
    </div>
  );
}
