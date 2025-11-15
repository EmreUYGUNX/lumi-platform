import type { ReactElement, ReactNode } from "react";

interface ImagePlaceholderProps {
  width?: number;
  height?: number;
  label?: string;
  icon?: ReactNode;
  className?: string;
}

const baseStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "0.5rem",
  background: "linear-gradient(135deg, #f3f4f6, #e5e7eb)",
  border: "1px dashed #cbd5f5",
  color: "#6b7280",
  fontSize: "0.875rem",
  fontWeight: 500,
  letterSpacing: "0.01em",
  textAlign: "center",
};

export function ImagePlaceholder({
  width = 320,
  height = 200,
  label = "Media preview unavailable",
  icon,
  className,
}: ImagePlaceholderProps): ReactElement {
  return (
    <div
      aria-live="polite"
      className={className}
      style={{
        ...baseStyles,
        width,
        height,
        minWidth: width,
        minHeight: height,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {icon}
        {label}
      </span>
    </div>
  );
}
