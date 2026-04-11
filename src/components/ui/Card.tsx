import * as React from "react";
import { cn } from "@/lib/utils";

// ── Card root ──────────────────────────────────────────────────────────────────
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Add a coloured left (in RTL: right) accent border. */
  accent?: "brand" | "accent" | "danger" | "warning";
}

export function Card({ className, accent, children, ...props }: CardProps) {
  const accentClass = {
    brand:   "border-r-4 border-r-brand-500",
    accent:  "border-r-4 border-r-accent-500",
    danger:  "border-r-4 border-r-danger",
    warning: "border-r-4 border-r-warning",
  }[accent!] ?? "";

  return (
    <div
      className={cn(
        "bg-surface rounded-3xl shadow-card overflow-hidden",
        accentClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Card sub-components ────────────────────────────────────────────────────────
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pt-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-base font-bold text-ink leading-tight", className)} {...props} />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-3 bg-surface-muted border-t border-surface-border flex items-center gap-3",
        className
      )}
      {...props}
    />
  );
}
