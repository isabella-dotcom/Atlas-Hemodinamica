"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type Toast = {
  id: string;
  title: string;
  tone?: "success" | "error" | "info";
};

type ToastContextValue = {
  push: (title: string, tone?: Toast["tone"]) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((title: string, tone: Toast["tone"] = "info") => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, title, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-sm",
              item.tone === "success" &&
                "border-emerald-200 bg-emerald-50 text-emerald-900",
              item.tone === "error" &&
                "border-rose-200 bg-rose-50 text-rose-900",
              item.tone === "info" &&
                "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]",
            )}
          >
            {item.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: (title: string) => {
        if (typeof window !== "undefined") window.alert(title);
      },
    };
  }
  return ctx;
}
