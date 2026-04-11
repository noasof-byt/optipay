"use client";

import * as Toast from "@radix-ui/react-toast";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/hooks/useToast";

const icons = {
  success: <CheckCircle2 size={18} className="text-accent-500 shrink-0" />,
  error:   <XCircle     size={18} className="text-danger shrink-0" />,
  warning: <AlertCircle size={18} className="text-warning shrink-0" />,
  info:    <AlertCircle size={18} className="text-brand-500 shrink-0" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          open={toast.open}
          onOpenChange={(open) => !open && dismiss(toast.id)}
          className={cn(
            "flex items-start gap-3 p-4 rounded-3xl shadow-float bg-surface",
            "border border-surface-border",
            "data-[state=open]:animate-slide-up",
            "data-[state=closed]:animate-fade-in"
          )}
        >
          {icons[toast.type]}
          <div className="flex-1 min-w-0">
            {toast.title && (
              <Toast.Title className="text-sm font-semibold text-ink">
                {toast.title}
              </Toast.Title>
            )}
            {toast.description && (
              <Toast.Description className="text-xs text-ink-muted mt-0.5">
                {toast.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close
            className="shrink-0 p-1 rounded-xl text-ink-faint hover:text-ink hover:bg-surface-muted transition-colors"
            aria-label="סגור"
          >
            <X size={14} />
          </Toast.Close>
        </Toast.Root>
      ))}

      <Toast.Viewport
        className={cn(
          "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)]",
          "inset-x-0 flex flex-col gap-2 px-4 z-50",
          "pointer-events-none [&>*]:pointer-events-auto"
        )}
      />
    </Toast.Provider>
  );
}
