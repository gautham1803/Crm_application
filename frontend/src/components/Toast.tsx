import React, { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "ai";
  actionLabel?: string;
  actionFn?: () => void;
}

let listeners: Array<(toast: ToastItem) => void> = [];

export function showToast(message: string, type: ToastItem["type"] = "success", actionLabel?: string, actionFn?: () => void) {
  const toast: ToastItem = { id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, message, type, actionLabel, actionFn };
  listeners.forEach(fn => fn(toast));
}

const BORDER_COLOR: Record<string, string> = {
  success: "var(--success)", error: "var(--error)", warning: "var(--warning)", ai: "var(--ai)",
};
const ICON: Record<string, string> = {
  success: "✓", error: "✕", warning: "⚠", ai: "✦",
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (toast: ToastItem) => setToasts(prev => [...prev, toast]);
    listeners.push(handler);
    return () => { listeners = listeners.filter(fn => fn !== handler); };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Auto-dismiss after 4s
  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => dismiss(latest.id), 4000);
    return () => clearTimeout(timer);
  }, [toasts.length]);

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 10000, display: "flex", flexDirection: "column-reverse", gap: 8, pointerEvents: "none" }}>
      {toasts.map((toast) => (
        <div key={toast.id} className="anim-fade-up" style={{
          pointerEvents: "all", background: "var(--bg-surface)", border: "1px solid var(--border-default)",
          borderLeft: `4px solid ${BORDER_COLOR[toast.type]}`, borderRadius: "var(--r-md)",
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", minWidth: 280, maxWidth: 420,
        }}>
          <span style={{ fontSize: 14, color: BORDER_COLOR[toast.type], flexShrink: 0, width: 18, textAlign: "center" }}>{ICON[toast.type]}</span>
          <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{toast.message}</span>
          {toast.actionLabel && (
            <button onClick={() => { toast.actionFn?.(); dismiss(toast.id); }}
              style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
              {toast.actionLabel}
            </button>
          )}
          <button onClick={() => dismiss(toast.id)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2 }}>
            <X style={{ width: 12, height: 12 }} />
          </button>
        </div>
      ))}
    </div>
  );
}
