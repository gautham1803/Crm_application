import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Sheet({ isOpen, onClose, title, children }: SheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
      // Prevent body scroll when sheet is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div style={{ position: "relative", zIndex: 9999 }}>
      <div 
        ref={overlayRef}
        style={{
          position: "fixed", inset: 0, background: "rgba(6,10,16,0.6)",
          backdropFilter: "blur(4px)", zIndex: 10000,
          animation: "sheetFadeIn 0.25s ease-out forwards"
        }}
        onClick={onClose}
      />
      <div 
        ref={panelRef}
        style={{
          position: "fixed", right: 0, top: 0, bottom: 0, width: "100%", maxWidth: 480,
          background: "var(--bg-surface)", borderLeft: "1px solid var(--border-default)",
          zIndex: 10001, boxShadow: "-10px 0 40px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
          animation: "sheetSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes sheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sheetSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );

  // Render into body to escape any CSS transforms from parent containers
  return createPortal(content, document.body);
}
