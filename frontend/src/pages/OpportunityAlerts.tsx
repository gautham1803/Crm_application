import React, { useState } from "react";
import { useAppStore, type OpportunityAlert } from "../lib/store";
import { Search, Bell, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Sparkles, Clock, Target, X } from "lucide-react";

export default function OpportunityAlertsPage() {
  const { opportunityAlerts, dismissOpportunityAlert } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "dismissed">("all");

  const filtered = opportunityAlerts.filter(a => {
    if (filter === "active" && a.dismissed) return false;
    if (filter === "dismissed" && !a.dismissed) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.accountName.toLowerCase().includes(q) || a.alertMessage.toLowerCase().includes(q) || a.summary?.toLowerCase().includes(q);
    }
    return true;
  });

  const strengthColor = (s: string) => s === "strong" ? "var(--success)" : s === "medium" ? "var(--warning)" : "var(--text-tertiary)";
  const timingLabel = (t: string) => {
    const map: Record<string, { label: string; color: string }> = {
      immediate: { label: "Act Now", color: "var(--error)" },
      this_week: { label: "This Week", color: "var(--warning)" },
      this_month: { label: "This Month", color: "var(--accent)" },
      not_now: { label: "Monitor", color: "var(--text-tertiary)" },
    };
    return map[t] || map.this_month;
  };

  return (
    <div className="page-wrapper anim-fade-up">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell style={{ width: 22, height: 22, color: "var(--ai)" }} />
            Opportunity Alerts
          </h1>
          <p className="page-subtitle">{opportunityAlerts.filter(a => !a.dismissed).length} active alerts from OpportunityWatchAgent</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-tertiary)" }} />
            <input
              className="input"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 32, width: 220, height: 34, fontSize: 12 }}
            />
          </div>
          <select className="input" value={filter} onChange={e => setFilter(e.target.value as any)} style={{ height: 34, fontSize: 12, width: 120 }}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
          <Bell style={{ width: 40, height: 40, opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 14 }}>No opportunity alerts yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Run OpportunityWatchAgent on accounts to generate alerts</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((alert: OpportunityAlert) => {
            const isExpanded = expandedId === alert.id;
            const timing = timingLabel(alert.recommendedTiming);
            return (
              <div
                key={alert.id}
                className="card"
                style={{
                  padding: 0,
                  opacity: alert.dismissed ? 0.5 : 1,
                  border: isExpanded ? "1px solid var(--border-accent)" : undefined,
                  transition: "all 0.2s",
                }}
              >
                {/* Header */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                >
                  {/* Score badge */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    background: alert.opportunityScore >= 70 ? "rgba(167,139,250,0.1)" : alert.opportunityScore >= 40 ? "rgba(56,189,248,0.1)" : "rgba(148,163,184,0.1)",
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: alert.opportunityScore >= 70 ? "var(--ai)" : "var(--accent)" }}>{alert.opportunityScore}</div>
                      <div style={{ fontSize: 8, color: "var(--text-tertiary)", marginTop: -2 }}>score</div>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{alert.alertMessage}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{alert.accountName}</span>
                      <span style={{ padding: "1px 8px", borderRadius: 8, fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", background: timing.color + "15", color: timing.color, border: `1px solid ${timing.color}30` }}>
                        {timing.label}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                        {new Date(alert.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {!alert.dismissed && (
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); dismissOpportunityAlert(alert.id); }} title="Dismiss">
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} /> : <ChevronDown style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Summary */}
                    {alert.summary && (
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{alert.summary}</div>
                    )}

                    {/* Signals */}
                    {alert.signalsFound?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "var(--font-display)" }}>
                          <TrendingUp style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Signals Detected
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {alert.signalsFound.map((s: any, i: number) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "var(--bg-elevated)" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: strengthColor(s.strength), flexShrink: 0 }} />
                              <span style={{ fontSize: 12, flex: 1 }}>{s.signal}</span>
                              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: strengthColor(s.strength), textTransform: "uppercase" }}>{s.strength}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outreach angle + talking points */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {alert.outreachAngle && (
                        <div style={{ background: "rgba(167,139,250,0.06)", borderRadius: "var(--r-md)", padding: 12, border: "1px solid rgba(167,139,250,0.15)" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ai)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "var(--font-display)" }}>
                            <Target style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Outreach Angle
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{alert.outreachAngle}</div>
                        </div>
                      )}
                      {alert.talkingPoints?.length > 0 && (
                        <div style={{ background: "rgba(56,189,248,0.06)", borderRadius: "var(--r-md)", padding: 12, border: "1px solid rgba(56,189,248,0.15)" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "var(--font-display)" }}>
                            <Sparkles style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Talking Points
                          </div>
                          {alert.talkingPoints.map((tp: string, i: number) => (
                            <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>▸ {tp}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Risk Factors */}
                    {alert.riskFactors?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--warning)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "var(--font-display)" }}>
                          <AlertTriangle style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Risk Factors
                        </div>
                        {alert.riskFactors.map((r: string, i: number) => (
                          <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>⚠ {r}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
