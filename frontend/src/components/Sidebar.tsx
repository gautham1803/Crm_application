import React from "react";
import { useAppStore } from "../lib/store";
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Package,
  CheckSquare,
  Calendar,
  Wand2,
  CheckCircle,
  PanelLeft,
  Bell,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Contacts", icon: Users, path: "/contacts" },
  { label: "Accounts", icon: Building2, path: "/accounts" },
  { label: "Deals", icon: Briefcase, path: "/deals" },
  { label: "Products", icon: Package, path: "/products" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
  { label: "Calendar", icon: Calendar, path: "/calendar" },
];

const AI_ITEMS = [
  { label: "AI Command", icon: Wand2, path: "/ai" },
  { label: "Approvals", icon: CheckCircle, path: "/approvals", badgeType: "approvals" },
  { label: "Opp. Alerts", icon: Bell, path: "/opportunity-alerts", badgeType: "oppAlerts" },
];

export default function Sidebar() {
  const navPosition = useAppStore((s) => s.navPosition);
  const toggleNavPosition = useAppStore((s) => s.toggleNavPosition);
  const approvalsList = useAppStore((s) => s.approvalsList);
  const opportunityAlerts = useAppStore((s) => s.opportunityAlerts);
  
  const pendingApprovalsCount = approvalsList.filter(a => !a.dismissed).length;

  if (navPosition !== "left") {
    return null;
  }

  const handleNavClick = (path: string) => {
    window.location.hash = path;
  };

  const renderNavSection = (items: typeof NAV_ITEMS, title?: string) => (
    <div style={{ marginBottom: "2rem" }}>
      {title && (
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            paddingLeft: "1rem",
            marginBottom: "0.75rem",
            letterSpacing: "0.05em",
          }}
        >
          {title}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = window.location.hash.slice(1) === item.path ||
                        (item.path !== "/" && window.location.hash.slice(1).startsWith(item.path));

        return (
          <button
            key={item.path}
            onClick={() => handleNavClick(item.path)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              border: "none",
              background: isActive ? "var(--bg-secondary)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 500,
              borderRadius: "0.375rem",
              transition: "all 200ms ease",
              marginBottom: "0.25rem",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
              <Icon size={18} />
              <span>{item.label}</span>
            </div>
            
            {/* Badges */}
            {(item as any).badgeType === "approvals" && pendingApprovalsCount > 0 && (
              <span style={{
                background: "var(--ai)", color: "#fff",
                fontSize: 10, fontWeight: 700, padding: "2px 6px",
                borderRadius: 12, fontFamily: "var(--font-mono)", lineHeight: 1,
              }}>
                {pendingApprovalsCount}
              </span>
            )}
            {(item as any).badgeType === "oppAlerts" && opportunityAlerts.filter(a => !a.dismissed).length > 0 && (
              <span style={{
                background: "var(--warning)", color: "#fff",
                fontSize: 10, fontWeight: 700, padding: "2px 6px",
                borderRadius: 12, fontFamily: "var(--font-mono)", lineHeight: 1,
              }}>
                {opportunityAlerts.filter(a => !a.dismissed).length}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        width: "240px",
        backgroundColor: "var(--bg-base)",
        borderRight: "1px solid var(--border-strong)",
        boxShadow: "4px 0 24px rgba(0,0,0,0.04)",
        padding: "1rem 0",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        overflowY: "auto",
        zIndex: 40,
      }}
    >
      {/* Logo + toggle */}
      <div style={{ padding: "0.75rem 1rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img
          src="/acufy-logo.svg"
          alt="Acufy AI"
          style={{ height: 32, width: "auto", objectFit: "contain", cursor: "pointer" }}
          onClick={() => { window.location.hash = "/"; }}
        />
        <button
          onClick={toggleNavPosition}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "6px", border: "1px solid var(--border-default)",
            background: "transparent", color: "var(--text-tertiary)",
            cursor: "pointer", borderRadius: 6, transition: "all 200ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
            (e.currentTarget as HTMLElement).style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
          }}
          title="Switch to top navigation"
        >
          <PanelLeft size={14} />
        </button>
      </div>

      {renderNavSection(NAV_ITEMS, "Main")}
      {renderNavSection(AI_ITEMS, "AI")}
    </div>
  );
}
