import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "../lib/store";
import { formatRelativeTime } from "../lib/utils";
import { showToast } from "./Toast";
import gsap from "gsap";
import {
  Search, Bell, Sun, Moon, ChevronDown, Check, Zap, Loader, PanelLeft,
  LayoutDashboard, Users, Building2, TrendingUp, Package,
  CheckCircle, Sparkles, ShieldCheck, Calendar,
} from "lucide-react";
import GlobalSearch from "./GlobalSearch";

const USERS = [
  { key: "admin", label: "Admin User", role: "ADMIN", email: "admin@acufy.com" },
  { key: "rep", label: "Sales Rep", role: "REP", email: "rep@acufy.com" },
  { key: "manager", label: "Sales Manager", role: "MANAGER", email: "mgr@acufy.com" },
];

const MAIN_NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/accounts", label: "Accounts", icon: Building2 },
  { path: "/deals", label: "Deals", icon: TrendingUp },
  { path: "/products", label: "Products", icon: Package },
  { path: "/tasks", label: "Tasks", icon: CheckCircle },
  { path: "/calendar", label: "Calendar", icon: Calendar },
];

const AI_NAV = [
  { path: "/ai", label: "AI Command", icon: Sparkles, isAI: true },
  { path: "/approvals", label: "Approvals", icon: ShieldCheck, badgeType: "approvals" },
  { path: "/opportunity-alerts", label: "Opp. Alerts", icon: Bell, badgeType: "oppAlerts" },
];

export default function TopBar() {
  const {
    devUser, setDevUser, theme, toggleTheme,
    setGlobalSearchOpen, notifications, markAllRead, agentRuns, role,
    navPosition, toggleNavPosition, opportunityAlerts, approvalsList
  } = useAppStore();
  const pendingApprovalsCount = approvalsList.filter(a => !a.dismissed).length;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || "/");
  const barRef = useRef<HTMLElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const currentUser = USERS.find((u) => u.key === devUser) || USERS[0]!;

  const isAnyRunning = agentRuns.some(r => r.status === "running");
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handler = () => setCurrentPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    if (barRef.current) {
      gsap.fromTo(barRef.current, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
    }
  }, []);

  useEffect(() => {
    if (bellRef.current && pendingApprovalsCount > 0) {
      gsap.fromTo(bellRef.current,
        { rotation: -10 },
        { rotation: 10, duration: 0.07, repeat: 5, yoyo: true, ease: "power1.inOut", onComplete: () => { gsap.set(bellRef.current, { rotation: 0 }); } }
      );
    }
  }, [pendingApprovalsCount]);

  const navigate = (path: string) => { window.location.hash = path; };
  const isActive = (path: string) =>
    currentPath === path || (path !== "/" && currentPath.startsWith(path));

  const switchUser = (key: string) => {
    setDevUser(key);
    setUserMenuOpen(false);
    setTimeout(() => window.location.reload(), 100);
  };

  const renderNavBtn = (item: { path: string; label: string; icon: any; isAI?: boolean; showBadge?: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    const special = item.isAI || item.showBadge;

    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        className="topnav-btn"
        data-active={active ? "true" : undefined}
        data-special={special ? "true" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          borderRadius: "var(--r-md)",
          border: "none",
          background: active
            ? special ? "rgba(167,139,250,0.12)" : "var(--bg-active)"
            : "transparent",
          color: active
            ? special ? "var(--ai)" : "var(--accent)"
            : "var(--text-secondary)",
          fontSize: 13,
          fontWeight: active ? 600 : 400,
          cursor: "pointer",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
          position: "relative",
          fontFamily: "var(--font-body)",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }
        }}
        title={item.label}
        aria-label={item.label}
      >
        <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
        <span>{item.label}</span>

        {(item as any).badgeType === "approvals" && pendingApprovalsCount > 0 && (
          <span style={{
            background: "var(--ai)", color: "#fff",
            fontSize: 9, fontWeight: 700, padding: "1px 5px",
            borderRadius: 10, fontFamily: "var(--font-mono)", lineHeight: 1.5,
            minWidth: 16, textAlign: "center",
          }}>
            {pendingApprovalsCount}
          </span>
        )}
        {(item as any).badgeType === "oppAlerts" && opportunityAlerts.filter(a => !a.dismissed).length > 0 && (
          <span style={{
            background: "var(--warning)", color: "#fff",
            fontSize: 9, fontWeight: 700, padding: "1px 5px",
            borderRadius: 10, fontFamily: "var(--font-mono)", lineHeight: 1.5,
            minWidth: 16, textAlign: "center",
          }}>
            {opportunityAlerts.filter(a => !a.dismissed).length}
          </span>
        )}

        {active && (
          <span style={{
            position: "absolute",
            bottom: -1,
            left: "50%",
            transform: "translateX(-50%)",
            width: "70%",
            height: 2,
            background: special ? "var(--ai)" : "var(--accent)",
            borderRadius: 2,
            display: "block",
          }} />
        )}
      </button>
    );
  };

  return (
    <header
      ref={barRef}
      style={{
        height: 56,
        background: "var(--topbar-bg)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 0,
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        onClick={() => navigate("/")}
        style={{
          display: "flex", alignItems: "center",
          flexShrink: 0, marginRight: 16, cursor: "pointer",
        }}
      >
        <img
          src="/acufy-logo.svg"
          alt="Acufy AI"
          style={{ height: 30, width: "auto", objectFit: "contain" }}
        />
      </div>

      {/* Sidebar toggle */}
      <button
        onClick={toggleNavPosition}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: "1px solid var(--border-default)",
          background: navPosition === "left" ? "rgba(56,189,248,0.08)" : "transparent",
          color: navPosition === "left" ? "var(--accent)" : "var(--text-secondary)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", flexShrink: 0, marginRight: 8,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = navPosition === "left" ? "rgba(56,189,248,0.08)" : "transparent"; e.currentTarget.style.color = navPosition === "left" ? "var(--accent)" : "var(--text-secondary)"; }}
        title={navPosition === "left" ? "Switch to top nav" : "Switch to sidebar"}
      >
        <PanelLeft style={{ width: 14, height: 14 }} />
      </button>

      {/* Nav separator */}
      <div style={{ width: 1, height: 20, background: "var(--border-subtle)", marginRight: 10, flexShrink: 0 }} />

      {/* Navigation — hidden when sidebar is active */}
      {navPosition === "top" && (
        <nav style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flex: 1,
          overflowX: "auto",
          scrollbarWidth: "none",
          minWidth: 0,
        }}>
          {MAIN_NAV.map(renderNavBtn)}

          <div style={{ width: 1, height: 18, background: "var(--border-subtle)", margin: "0 6px", flexShrink: 0 }} />

          {AI_NAV.map(renderNavBtn)}
        </nav>
      )}

      {navPosition === "left" && <div style={{ flex: 1 }} />}

      {/* Right Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 10 }}>

        {/* Search bar */}
        <GlobalSearch />

        {/* AI Status pill */}
        <div
          onClick={() => navigate("/ai")}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px",
            background: isAnyRunning ? "rgba(56,189,248,0.08)" : "rgba(52,211,153,0.08)",
            border: `1px solid ${isAnyRunning ? "rgba(56,189,248,0.2)" : "rgba(52,211,153,0.2)"}`,
            borderRadius: 20, fontSize: 11, fontWeight: 500,
            cursor: "pointer", transition: "all 0.2s",
            color: isAnyRunning ? "var(--accent)" : "var(--success)",
          }}
        >
          {isAnyRunning ? (
            <><Loader style={{ width: 10, height: 10 }} className="anim-spin" /> Running</>
          ) : (
            <><span className="ai-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} /> AI Ready</>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "transparent", color: "var(--text-secondary)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          {theme === "dark" ? <Moon style={{ width: 14, height: 14 }} /> : <Sun style={{ width: 14, height: 14 }} />}
        </button>

        {/* Notification Bell */}
        <div style={{ position: "relative" }}>
          <button
            ref={bellRef}
            onClick={() => setNotifOpen(!notifOpen)}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "transparent", color: "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", position: "relative",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <Bell style={{ width: 14, height: 14 }} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                width: 16, height: 16, borderRadius: "50%",
                background: "var(--ai)", border: "2px solid var(--bg-surface)",
                fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontFamily: "var(--font-mono)",
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => setNotifOpen(false)} />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340,
                background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                borderRadius: "var(--r-lg)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                zIndex: 61, overflow: "hidden",
              }} className="anim-fade-up">
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700 }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); markAllRead(); }} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>No notifications</div>
                  ) : notifications.slice(0, 8).map((n) => (
                    <div key={n.id}
                      onClick={() => { if (n.link) navigate(n.link); setNotifOpen(false); }}
                      style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", transition: "background 0.1s", display: "flex", gap: 10, alignItems: "flex-start", background: n.read ? "transparent" : "rgba(56,189,248,0.03)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = n.read ? "transparent" : "rgba(56,189,248,0.03)"}
                    >
                      {!n.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 6, flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.description}</div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{formatRelativeTime(n.timestamp)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 8px", borderRadius: 8,
              cursor: "pointer", background: "transparent", border: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "#fff",
            }}>
              {currentUser.label.split(" ").map(w => w[0]).join("")}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--text-primary)", lineHeight: 1.2 }}>{currentUser.label}</div>
              <div style={{ fontSize: 9, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{currentUser.role}</div>
            </div>
            <ChevronDown style={{ width: 12, height: 12, color: "var(--text-tertiary)" }} />
          </button>

          {userMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setUserMenuOpen(false)} />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)", width: 200,
                background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                borderRadius: "var(--r-lg)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                zIndex: 51, padding: 8,
              }} className="anim-fade-up">
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "var(--text-tertiary)", textTransform: "uppercase", padding: "4px 8px", marginBottom: 4, fontFamily: "var(--font-display)" }}>Switch User</div>
                {USERS.map((u) => (
                  <button key={u.key} onClick={() => switchUser(u.key)} style={{
                    display: "flex", width: "100%", alignItems: "center", gap: 8,
                    padding: "8px", borderRadius: "var(--r-sm)", border: "none",
                    background: "transparent", cursor: "pointer", color: "var(--text-primary)", textAlign: "left", transition: "background 0.1s",
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#4F46E5,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {u.label[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{u.label}</div>
                      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>{u.email}</div>
                    </div>
                    {u.key === devUser && <Check style={{ width: 12, height: 12, color: "var(--accent)" }} />}
                  </button>
                ))}
                <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 0" }} />
                {role === "admin" && (
                  <button onClick={() => { setUserMenuOpen(false); showToast("Settings panel coming soon", "ai"); }}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "8px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", fontSize: 12, transition: "background 0.1s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    ⚙ Team Settings
                  </button>
                )}
                <button onClick={() => { setUserMenuOpen(false); showToast("Signed out successfully", "success"); }}
                  style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "8px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--error)", fontSize: 12, transition: "background 0.1s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
