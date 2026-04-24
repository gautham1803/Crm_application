import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Trash2, CheckCircle, Info } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "success";
  icon?: React.ReactNode;
  loading?: boolean;
}

const VARIANT_CONFIG = {
  danger: {
    color: "var(--error)",
    bg: "rgba(248,113,113,0.08)",
    border: "rgba(248,113,113,0.25)",
    btnBg: "linear-gradient(135deg, #EF4444, #DC2626)",
    icon: <Trash2 style={{ width: 22, height: 22 }} />,
  },
  warning: {
    color: "var(--warning)",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.25)",
    btnBg: "linear-gradient(135deg, #F59E0B, #D97706)",
    icon: <AlertTriangle style={{ width: 22, height: 22 }} />,
  },
  info: {
    color: "var(--accent)",
    bg: "rgba(56,189,248,0.08)",
    border: "rgba(56,189,248,0.25)",
    btnBg: "linear-gradient(135deg, var(--accent), #0EA5E9)",
    icon: <Info style={{ width: 22, height: 22 }} />,
  },
  success: {
    color: "var(--success)",
    bg: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.25)",
    btnBg: "linear-gradient(135deg, #34D399, #059669)",
    icon: <CheckCircle style={{ width: 22, height: 22 }} />,
  },
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon,
  loading = false,
}: ConfirmDialogProps) {
  const [animating, setAnimating] = useState(false);
  const config = VARIANT_CONFIG[variant];

  useEffect(() => {
    if (isOpen) setAnimating(true);
  }, [isOpen]);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !loading) onClose();
  }, [onClose, loading]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: "absolute", zIndex: 99999 }}>
      {/* Backdrop */}
      <div
        onClick={!loading ? onClose : undefined}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(6,10,16,0.7)",
          backdropFilter: "blur(8px)",
          zIndex: 3000,
          animation: "confirmFadeIn 0.2s ease-out forwards",
        }}
      />
      {/* Dialog */}
      <div
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "var(--bg-surface)",
          border: `1px solid ${config.border}`,
          borderRadius: "var(--r-xl)",
          padding: 0,
          zIndex: 3001,
          width: 420,
          maxWidth: "90vw",
          boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 40px ${config.bg}`,
          animation: "confirmSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          overflow: "hidden",
        }}
      >
        {/* Top accent bar */}
        <div style={{
          height: 3,
          background: config.btnBg,
          borderRadius: "var(--r-xl) var(--r-xl) 0 0",
        }} />

        <div style={{ padding: "24px 28px 20px" }}>
          {/* Icon + Close */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48,
              borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: config.bg,
              border: `1px solid ${config.border}`,
              color: config.color,
            }}>
              {icon || config.icon}
            </div>
            <button
              onClick={!loading ? onClose : undefined}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                width: 32, height: 32,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: loading ? "not-allowed" : "pointer",
                color: "var(--text-tertiary)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: "var(--font-display)",
            fontSize: 17, fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 8,
            letterSpacing: -0.3,
          }}>
            {title}
          </h3>

          {/* Message */}
          <p style={{
            fontSize: 13.5,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 0,
          }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          padding: "16px 28px 24px",
          display: "flex", gap: 10,
          justifyContent: "flex-end",
        }}>
          <button
            className="btn btn-ghost"
            onClick={!loading ? onClose : undefined}
            disabled={loading}
            style={{
              padding: "9px 20px",
              fontSize: 13,
              borderRadius: "var(--r-md)",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={!loading ? onConfirm : undefined}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "9px 22px",
              borderRadius: "var(--r-md)",
              background: config.btnBg,
              color: "#fff",
              fontFamily: "var(--font-body)",
              fontSize: 13, fontWeight: 600,
              border: "none", cursor: loading ? "wait" : "pointer",
              boxShadow: `0 4px 16px ${config.bg}`,
              transition: "all 0.15s",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.filter = "brightness(1.12)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
          >
            {loading ? (
              <span className="anim-spin" style={{ fontSize: 14 }}>✦</span>
            ) : null}
            {confirmText}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes confirmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirmSlideUp {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}

// Global confirm function replacement
let _resolveConfirm: ((v: boolean) => void) | null = null;
let _setDialogState: React.Dispatch<React.SetStateAction<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  variant: "danger" | "warning" | "info" | "success";
}>> | null = null;

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    isOpen: false,
    title: "Confirm",
    message: "",
    confirmText: "Confirm",
    variant: "danger" as "danger" | "warning" | "info" | "success",
  });

  _setDialogState = setState;

  const handleClose = () => {
    setState((s) => ({ ...s, isOpen: false }));
    _resolveConfirm?.(false);
    _resolveConfirm = null;
  };

  const handleConfirm = () => {
    setState((s) => ({ ...s, isOpen: false }));
    _resolveConfirm?.(true);
    _resolveConfirm = null;
  };

  return (
    <>
      {children}
      <ConfirmDialog
        isOpen={state.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText}
        variant={state.variant}
      />
    </>
  );
}

export function confirmAction(opts: {
  title?: string;
  message: string;
  confirmText?: string;
  variant?: "danger" | "warning" | "info" | "success";
}): Promise<boolean> {
  return new Promise((resolve) => {
    _resolveConfirm = resolve;
    _setDialogState?.({
      isOpen: true,
      title: opts.title || "Confirm",
      message: opts.message,
      confirmText: opts.confirmText || "Confirm",
      variant: opts.variant || "danger",
    });
  });
}
