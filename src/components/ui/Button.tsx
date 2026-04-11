import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base
  "inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-sm",
        secondary:
          "bg-transparent border-2 border-brand-500 text-brand-500 hover:bg-brand-50 active:bg-brand-100",
        accent:
          "bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white shadow-sm",
        ghost:
          "bg-transparent hover:bg-surface-muted text-ink-muted",
        danger:
          "bg-danger hover:bg-red-600 text-white",
        outline:
          "bg-surface border border-surface-border text-ink hover:bg-surface-muted",
      },
      size: {
        sm:  "h-9  px-4 text-xs",
        md:  "h-11 px-5 text-sm",
        lg:  "h-13 px-6 text-base",
        icon:"h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>טוען...</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";
