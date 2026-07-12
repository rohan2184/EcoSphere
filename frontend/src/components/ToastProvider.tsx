import React, { createContext, useContext, useState, useCallback } from "react";
import { Toast } from "./ui";

interface ToastContextValue {
  showToast: (message: string, tone?: "neutral" | "green" | "red") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: "neutral" | "green" | "red" } | null>(null);

  const showToast = useCallback((message: string, tone: "neutral" | "green" | "red" = "neutral") => {
    setToast({ message, tone });
  }, []);

  const handleDismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDismiss={handleDismiss} />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
