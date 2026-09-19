import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "warning" | "error" | "success";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss ms; default 6000. 0 = sticky until dismissed. */
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CLASS: Record<ToastVariant, string> = {
  info: "border-border bg-card text-foreground",
  success: "border-emerald-700/30 bg-emerald-50 text-emerald-950",
  warning: "border-amber-700/30 bg-amber-50 text-amber-950",
  error: "border-destructive/40 bg-red-50 text-red-950",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const idPrefix = useId();
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const variant = input.variant ?? "info";
      const durationMs = input.durationMs ?? 6000;
      setItems((prev) => [...prev, { ...input, id, variant }]);
      if (durationMs > 0) {
        window.setTimeout(() => dismiss(id), durationMs);
      }
    },
    [dismiss, idPrefix],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg ${VARIANT_CLASS[item.variant]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{item.title}</p>
                {item.description ? (
                  <p className="text-xs opacity-90">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 text-xs opacity-70 hover:opacity-100"
                aria-label="Dismiss"
                onClick={() => dismiss(item.id)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  // Pop-out windows / isolated roots may not wrap ToastProvider.
  return {
    toast: (input) => {
      console.warn("[toast]", input.title, input.description ?? "");
    },
  };
}
