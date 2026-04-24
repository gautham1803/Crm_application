import React, { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dealsApi, tasksApi, contactsApi, type Deal, type Task, type Contact } from "../lib/api";
import { formatCurrency, formatRelativeTime, formatDate } from "../lib/utils";
import { useAppStore } from "../lib/store";
import gsap from "gsap";
import { AlertCircle, Calendar, Clock, Video, TrendingUp, DollarSign, Users, Target, Sparkles, ArrowUpRight, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });
  const { data: tasksRes } = useQuery({ queryKey: ["tasks"], queryFn: () => tasksApi.list({}) });
  const { data: contactsRes } = useQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });
  const { pendingApprovalsCount, role, contactScores, opportunityAlerts, winProbabilities } = useAppStore();

  const deals: Deal[] = dealsRes?.data?.items || [];
  const tasks: Task[] = tasksRes?.data?.items || [];
  const contacts: Contact[] = contactsRes?.data?.items || [];
  const activeDeals = deals.filter((d: Deal) => d.stage?.name !== "Closed Won" && d.stage?.name !== "Closed Lost");
  const totalValue = deals.reduce((sum: number, d: Deal) => sum + (d.amount || 0), 0);
  const wonDeals = deals.filter((d: Deal) => d.stage?.name === "Closed Won");
  const wonValue = wonDeals.reduce((sum: number, d: Deal) => sum + (d.amount || 0), 0);

  const now = new Date();
  const overdueTasks = tasks.filter((t: Task) => t.due_at && new Date(t.due_at) < now && t.status !== "done");

  // Simulated meetings for today
  const todayMeetings = [
    { time: "10:00 AM", title: "Demo — TechVista Solutions", contact: "Sarah Chen", type: "video" as const },
    { time: "2:30 PM", title: "Proposal Review — GreenLeaf", contact: "James Foster", type: "call" as const },
    { time: "4:00 PM", title: "Check-in — Atlas Financial", contact: "Michael Park", type: "video" as const },
  ];

  const kpiRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (kpiRef.current) gsap.fromTo(kpiRef.current.children, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: "power2.out" });
    if (gridRef.current) gsap.fromTo(gridRef.current.children, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: "power2.out", delay: 0.2 });
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const { devUser } = useAppStore();
  const userName = devUser === "admin" ? "Admin" : devUser === "manager" ? "Manager" : "Sales Rep";

  return (
    <div className="page-wrapper anim-fade-up">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: "linear-gradient(135deg, var(--accent), var(--ai))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{greeting},</span> {userName}
          </h1>
          <p className="page-subtitle">Here's your pipeline at a glance · <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{formatCurrency(totalValue)}</span> in pipeline</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)", padding: "4px 10px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>{deals.length} deals</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)", padding: "4px 10px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>{contacts.length} contacts</span>
        </div>
      </div>

      {/* AI STRIP */}
      {pendingApprovalsCount() > 0 && role !== "rep" && (
        <div className="ai-strip anim-fade-up">
          <div className="ai-strip-dot"></div>
          <div className="ai-strip-text"><strong>{pendingApprovalsCount()} AI draft{pendingApprovalsCount() !== 1 ? "s" : ""}</strong> awaiting your review — NurturerAgent drafted outreach for Meridian CRM Migration</div>
          <button className="btn btn-ai btn-sm" onClick={() => window.location.hash = "/approvals"}>Review Now →</button>
        </div>
      )}

      {/* OVERDUE TASKS ALERT */}
      {overdueTasks.length > 0 && (
        <div className="anim-fade-up" style={{
          background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: "var(--r-lg)", padding: "12px 20px", display: "flex", alignItems: "center",
          gap: 12, marginBottom: 16,
        }}>
          <AlertCircle style={{ width: 16, height: 16, color: "var(--error)", flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--error)" }}>{overdueTasks.length} overdue task{overdueTasks.length !== 1 ? "s" : ""}</strong> — {overdueTasks[0]?.title}
            {overdueTasks.length > 1 && ` and ${overdueTasks.length - 1} more`}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.hash = "/tasks"}>View Tasks</button>
        </div>
      )}

      {/* KPI CARDS */}
      <div ref={kpiRef} className="grid-stats">
        <div className="stat-card card-glow shimmer-bg glow-ring" style={{ cursor: "pointer" }} onClick={() => window.location.hash = "/deals"}>
          <div className="stat-icon" style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(14,165,233,0.08))", color: "var(--accent)" }}><DollarSign style={{ width: 18, height: 18 }} /></div>
          <div className="stat-trend up"><ArrowUpRight style={{ width: 12, height: 12 }} /> +12.5% <span style={{ color: "var(--text-tertiary)" }}>vs last month</span></div>
          <div className="stat-value counter-value">{formatCurrency(totalValue)}</div>
          <div className="stat-label">Total Pipeline</div>
        </div>
        <div className="stat-card card-glow shimmer-bg glow-ring" style={{ cursor: "pointer" }} onClick={() => window.location.hash = "/deals"}>
          <div className="stat-icon" style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(5,150,105,0.08))", color: "var(--success)" }}><Target style={{ width: 18, height: 18 }} /></div>
          <div className="stat-trend up"><ArrowUpRight style={{ width: 12, height: 12 }} /> +8.2%</div>
          <div className="stat-value counter-value">{formatCurrency(wonValue)}</div>
          <div className="stat-label">Won Revenue</div>
        </div>
        <div className="stat-card card-glow shimmer-bg glow-ring" style={{ cursor: "pointer" }} onClick={() => window.location.hash = "/deals"}>
          <div className="stat-icon" style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.15), rgba(59,130,246,0.08))", color: "#60A5FA" }}><TrendingUp style={{ width: 18, height: 18 }} /></div>
          <div className="stat-trend up">{activeDeals.length} active</div>
          <div className="stat-value counter-value">{activeDeals.length}</div>
          <div className="stat-label">Active Deals</div>
        </div>
        <div className="stat-card card-glow shimmer-bg glow-ring" style={{ cursor: "pointer" }} onClick={() => window.location.hash = "/contacts"}>
          <div className="stat-icon" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(124,58,237,0.08))", color: "var(--ai)" }}><Users style={{ width: 18, height: 18 }} /></div>
          <div className="stat-trend up"><ArrowUpRight style={{ width: 12, height: 12 }} /> {contacts.length} total</div>
          <div className="stat-value counter-value">{contacts.length}</div>
          <div className="stat-label">Total Contacts</div>
        </div>
      </div>

      <div ref={gridRef} className="grid-panels">
        {/* PIPELINE */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Pipeline Breakdown</span>
            <span className="section-link" onClick={() => window.location.hash = "/deals"}>{deals.length} deals</span>
          </div>
          {["Proposal", "Negotiation", "Demo/Meeting", "Qualified", "Closed Won", "Lead"].map((stage) => {
            const stageDeals = deals.filter((d: Deal) => d.stage?.name === stage);
            const stageAmt = stageDeals.reduce((sum: number, d: Deal) => sum + (d.amount || 0), 0);
            const pct = totalValue > 0 ? (stageAmt / totalValue) * 100 : 0;
            return (
              <div key={stage} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 90, flexShrink: 0 }}>{stage === "Closed Won" ? "Won" : stage}</span>
                <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: stage === "Closed Won" ? "linear-gradient(90deg,var(--success),#059669)" : stage === "Lead" ? "var(--text-tertiary)" : "linear-gradient(90deg,var(--accent),var(--ai))", transition: "width 1s ease" }}></div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", width: 70, textAlign: "right", flexShrink: 0 }}>{formatCurrency(stageAmt)}</span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", width: 20, textAlign: "right", flexShrink: 0 }}>{stageDeals.length}</span>
              </div>
            );
          })}
        </div>

        {/* TODAY'S MEETINGS */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Today's Schedule</span>
            <span className="section-link" onClick={() => window.location.hash = "/calendar"}>{todayMeetings.length} scheduled</span>
          </div>
          <div style={{ position: "relative", paddingLeft: 20 }}>
            {/* Vertical timeline line */}
            <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 2, background: "linear-gradient(to bottom, var(--accent), var(--ai))", borderRadius: 1, opacity: 0.3 }} />
            {todayMeetings.map((mtg, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: idx < todayMeetings.length - 1 ? "1px solid var(--border-subtle)" : "none", position: "relative" }}>
                {/* Timeline dot */}
                <div style={{ position: "absolute", left: -18, width: 10, height: 10, borderRadius: "50%", background: mtg.type === "video" ? "var(--accent)" : "var(--success)", border: "2px solid var(--bg-card)", boxShadow: `0 0 8px ${mtg.type === "video" ? "rgba(56,189,248,0.4)" : "rgba(52,211,153,0.4)"}` }} />
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: mtg.type === "video" ? "rgba(56,189,248,0.1)" : "rgba(52,211,153,0.1)",
                  color: mtg.type === "video" ? "var(--accent)" : "var(--success)",
                }}>
                  {mtg.type === "video" ? <Video style={{ width: 14, height: 14 }} /> : <Clock style={{ width: 14, height: 14 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{mtg.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{mtg.contact}</div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", flexShrink: 0, padding: "3px 8px", background: "rgba(56,189,248,0.08)", borderRadius: 6 }}>{mtg.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* QUICK INSIGHTS + AI WIDGET */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="section-header"><span className="section-title">Quick Insights</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>Win Rate</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--success)" }}>{deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>Avg Deal Size</span><span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{formatCurrency(totalValue / (deals.length || 1))}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>Avg Probability</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{deals.length > 0 ? Math.round(deals.reduce((s, d) => s + (d.probability || 0), 0) / deals.length) : 0}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>Contacts / Account</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>4.0</span>
            </div>
          </div>
          {/* AI COMMAND WIDGET */}
          {role !== "rep" && (
            <div className="glass-card" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
              {/* Floating particles */}
              {[0,1,2].map(i => (
                <div key={i} style={{
                  position: "absolute", width: 4, height: 4, borderRadius: "50%",
                  background: i === 0 ? "var(--accent)" : i === 1 ? "var(--ai)" : "var(--success)",
                  top: `${20 + i * 25}%`, right: `${10 + i * 15}%`,
                  animation: `floatParticle ${2 + i * 0.5}s ease-in-out infinite ${i * 0.3}s`,
                  opacity: 0.5,
                }} />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, position: "relative" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, var(--ai), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles style={{ width: 16, height: 16, color: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }}>AI Command Center</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>8 agents ready</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14, position: "relative" }}>Launch AI agents to qualify leads, draft emails, or progress deals automatically.</p>
              <button className="btn btn-ai" style={{ width: "100%", justifyContent: "center" }} onClick={() => window.location.hash = "/ai"}>
                <Sparkles style={{ width: 12, height: 12 }} /> Open AI Command
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ROW: Top Deals + Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* TOP DEALS */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Top Deals</span>
            <span className="section-link" onClick={() => window.location.hash = "/deals"}>View all →</span>
          </div>
          {[...deals].sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 5).map((deal: Deal, idx) => {
            const prob = deal.probability || 0;
            const circumference = 2 * Math.PI * 12;
            const offset = circumference - (prob / 100) * circumference;
            const probColor = prob >= 70 ? "var(--success)" : prob >= 40 ? "var(--warning)" : "var(--error)";
            return (
              <div key={deal.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < 4 ? "1px solid var(--border-subtle)" : "none" }}>
                {/* Mini donut */}
                <svg width="28" height="28" style={{ flexShrink: 0 }}>
                  <circle cx="14" cy="14" r="12" fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                  <circle cx="14" cy="14" r="12" fill="none" stroke={probColor} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 14 14)" style={{ transition: "stroke-dashoffset 1s ease" }} />
                  <text x="14" y="14" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 7, fontFamily: "var(--font-mono)", fontWeight: 700, fill: probColor }}>{prob}</text>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{deal.name}</div>
                  <span className="pill pill-neutral" style={{ marginTop: 2 }}>{deal.stage?.name || "Lead"}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>{formatCurrency(deal.amount || 0)}</div>
              </div>
            );
          })}
        </div>

        {/* RECENT ACTIVITY */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Recent Activity</span>
            <span className="section-link" onClick={() => window.location.hash = "/contacts"}>View all</span>
          </div>
          {[
            { icon: "📝", bg: "rgba(74,85,120,0.2)", color: "var(--text-secondary)", title: "Post-Sale Note", desc: "Great customer — potential case study candidate.", time: "14h ago" },
            { icon: "💬", bg: "rgba(52,211,153,0.1)", color: "var(--success)", title: "Follow Up", desc: "Followed up on proposal via SMS.", time: "1d ago" },
            { icon: "⚡", bg: "rgba(167,139,250,0.1)", color: "var(--ai)", title: "Contract Signed", desc: "Olivia signed the annual contract.", time: "1d ago" },
            { icon: "✉️", bg: "rgba(56,189,248,0.1)", color: "var(--accent)", title: "Welcome Email", desc: "Sent welcome email to Alex.", time: "3d ago" },
          ].map((item, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: idx < 3 ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, marginTop: 1, background: item.bg, color: item.color }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.desc}</div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>{item.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI INSIGHTS ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* HOTTEST LEADS */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">🎯 Hottest Leads</span>
            <span className="section-link" onClick={() => window.location.hash = "/contacts"}>View all →</span>
          </div>
          {(() => {
            const scored = Object.entries(contactScores)
              .map(([name, data]: [string, any]) => ({ name, score: data.overallScore, qualification: data.qualification }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);
            if (scored.length === 0) return (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No leads scored yet. Create a contact to trigger AI scoring.</div>
            );
            return scored.map((lead, idx) => {
              const color = lead.qualification === "hot" ? "var(--error)" : lead.qualification === "warm" ? "var(--warning)" : "var(--text-tertiary)";
              return (
                <div key={lead.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < scored.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{lead.name}</div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30` }}>
                    {lead.score}/100
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color, letterSpacing: 0.5 }}>{lead.qualification}</span>
                </div>
              );
            });
          })()}
        </div>

        {/* OPPORTUNITY ALERTS */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">🔔 Opportunity Alerts</span>
            <span className="section-link">{opportunityAlerts.filter(a => !a.dismissed).length} active</span>
          </div>
          {(() => {
            const active = opportunityAlerts.filter(a => !a.dismissed).slice(0, 5);
            if (active.length === 0) return (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>No active alerts. Run OpportunityWatchAgent to scan for signals.</div>
            );
            return active.map((alert, idx) => (
              <div key={alert.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: idx < active.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: alert.opportunityScore >= 70 ? "rgba(56,189,248,0.1)" : "rgba(251,191,36,0.1)",
                  color: alert.opportunityScore >= 70 ? "var(--accent)" : "var(--warning)",
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                }}>
                  {alert.opportunityScore}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{alert.accountName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{alert.alertMessage}</div>
                </div>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", flexShrink: 0, padding: "2px 6px", borderRadius: 4, background: "var(--bg-elevated)" }}>
                  {alert.recommendedTiming}
                </span>
              </div>
            ));
          })()}
        </div>

        {/* DEALS AT RISK */}
        {(() => {
          const atRisk = Object.entries(winProbabilities)
            .filter(([, data]) => data.probability < 40)
            .sort(([, a], [, b]) => a.probability - b.probability);
          if (atRisk.length === 0) return null;
          return (
            <div className="card" style={{ borderLeft: "3px solid var(--error)" }}>
              <div className="section-header">
                <span className="section-title">⚠️ Deals at Risk</span>
                <span className="section-link" onClick={() => window.location.hash = "/deals"}>View pipeline →</span>
              </div>
              {atRisk.slice(0, 5).map(([dealName, data], idx) => {
                const probColor = data.probability < 20 ? "var(--error)" : "var(--warning)";
                return (
                  <div key={dealName} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < Math.min(atRisk.length, 5) - 1 ? "1px solid var(--border-subtle)" : "none", cursor: "pointer" }} onClick={() => window.location.hash = "/deals"}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      background: `${probColor}15`, color: probColor,
                      fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                    }}>
                      {data.probability}%
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{dealName}</div>
                      {data.factors?.length > 0 && (
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.4, marginTop: 2 }}>{data.factors[0]}</div>
                      )}
                    </div>
                    {/* Mini sparkline */}
                    {data.history.length > 1 && (() => {
                      const h = data.history;
                      const w = 50, ht = 16;
                      const minV = Math.max(0, Math.min(...h) - 5);
                      const maxV = Math.min(100, Math.max(...h) + 5);
                      const range = maxV - minV || 1;
                      const pts = h.map((v, i) => `${(i / (h.length - 1)) * w},${ht - ((v - minV) / range) * ht}`).join(" ");
                      return (
                        <svg width={w} height={ht} style={{ flexShrink: 0 }}>
                          <polyline points={pts} fill="none" stroke={probColor} strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
