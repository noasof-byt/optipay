import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, startIcon, endIcon, id, ...props }, ref) => {
    const inputId = id ?? label?.replace(/\s+/g, "-").toLowerCase();

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {/* Start icon (in RTL this appears on the right side visually) */}
          {startIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none">
              {startIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              "input",
              startIcon && "pr-10",
              endIcon && "pl-10",
              error && "border-danger focus:ring-danger",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />

          {/* End icon (in RTL this appears on the left side visually) */}
          {endIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
              {endIcon}
            </span>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-ink-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
