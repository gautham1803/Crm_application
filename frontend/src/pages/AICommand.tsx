import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { aiApi, contactsApi, accountsApi, dealsApi, type Contact, type Account, type Deal } from "../lib/api";
import { useAppStore } from "../lib/store";
import { useAgentSimulation } from "../lib/useAgentSimulation";
import { formatCurrency } from "../lib/utils";
import gsap from "gsap";
import { X, ChevronDown, ChevronUp, Bot, Sparkles, Activity, Play, StopCircle, Zap } from "lucide-react";

const MISSIONS = [
  {
    id: "lead_qualification",
    label: "Lead Qualification",
    desc: "Score and qualify inbound leads using BANT criteria and public source research.",
    icon: "🎯",
    color: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.2)",
    modelGroup: "llama",
  },
  {
    id: "account_research",
    label: "Account Research",
    desc: "Enrich accounts with public intelligence — news, funding, job signals, tech stack.",
    icon: "🔍",
    color: "rgba(251,191,36,0.1)",
    border: "rgba(251,191,36,0.2)",
    modelGroup: "llama",
  },
  {
    id: "deal_progression",
    label: "Deal Progression",
    desc: "Advance a stalled deal through pipeline stages with AI-proposed next actions.",
    icon: "📈",
    color: "rgba(167,139,250,0.1)",
    border: "rgba(167,139,250,0.2)",
    modelGroup: "llama",
  },
  {
    id: "outbound_campaign",
    label: "Outbound Campaign",
    desc: "Draft personalized outreach emails to a contact list using deal context and persona.",
    icon: "✉",
    color: "rgba(56,189,248,0.1)",
    border: "rgba(56,189,248,0.2)",
    modelGroup: "mistral",
  },
  {
    id: "nurture_sequence",
    label: "Nurture Sequence",
    desc: "Build a multi-touch follow-up sequence for contacts at any deal stage.",
    icon: "💌",
    color: "rgba(248,113,113,0.1)",
    border: "rgba(248,113,113,0.2)",
    modelGroup: "mistral",
  },
  {
    id: "opportunity_watch",
    label: "Opportunity Watch",
    desc: "Scan an account for buying signals — funding, leadership changes, expansion — and surface the right moment to reach out.",
    icon: "👁",
    color: "rgba(34,211,238,0.1)",
    border: "rgba(34,211,238,0.2)",
    modelGroup: "mistral",
  },
  {
    id: "generate_proposal",
    label: "Generate Proposal",
    desc: "Auto-generate a complete sales proposal document with pricing, timeline, and why-us when a deal hits the Proposal stage.",
    icon: "📄",
    color: "rgba(132,204,22,0.1)",
    border: "rgba(132,204,22,0.2)",
    modelGroup: "mistral",
  },
  {
    id: "schedule_meeting",
    label: "Schedule Meeting",
    desc: "Find available time slots and draft a professional scheduling email — goes to Approvals before anything sends.",
    icon: "📅",
    color: "rgba(249,115,22,0.1)",
    border: "rgba(249,115,22,0.2)",
    modelGroup: "mistral",
  },
];

// ── Mission Card ──────────────────────────────────────────────
function MissionCard({ m, expanded, onSelect, contacts, accounts, deals, onLaunch }: {
  m: typeof MISSIONS[0]; expanded: boolean;
  onSelect: () => void; contacts: Contact[]; accounts: Account[]; deals: Deal[];
  onLaunch: (missionId: string, goal: string, entity?: string, channel?: string) => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleLaunch = () => {
    const entity = formData.contact || formData.account || formData.deal || "";
    const goal = `${m.label}: ${entity || "All selected"}`;
    onLaunch(m.id, goal, entity, formData.channel || "EMAIL");
    setFormData({});
  };

  const launchLabel: Record<string, string> = {
    outbound_campaign: "Launch Campaign",
    lead_qualification: "Qualify Lead",
    deal_progression: "Progress Deal",
    account_research: "Research Account",
    nurture_sequence: "Start Nurture",
    opportunity_watch: "Watch for Signals",
    generate_proposal: "Generate Proposal",
    schedule_meeting: "Schedule Meeting",
  };

  return (
    <div
      onClick={!expanded ? onSelect : undefined}
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${expanded ? "var(--border-accent)" : "var(--border-default)"}`,
        borderRadius: "var(--r-xl)",
        cursor: expanded ? "default" : "pointer",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        position: "relative",
        overflow: "hidden",
        transform: expanded ? "translateY(-4px)" : "none",
        boxShadow: expanded ? "0 12px 40px rgba(0,0,0,0.2)" : "var(--shadow-card)",
      }}
      className="group"
      onMouseEnter={(e) => {
        if (!expanded) {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-glow)";
        }
      }}
      onMouseLeave={(e) => {
        if (!expanded) {
          (e.currentTarget as HTMLElement).style.transform = "none";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
        }
      }}
    >
      {/* Background Glow */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at top right, ${m.color}, transparent 70%)`, opacity: expanded ? 1 : 0.5, transition: "opacity 0.3s", pointerEvents: "none" }} />

      <div style={{ padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16, position: "relative", zIndex: 1, background: "var(--bg-elevated)", border: `1px solid ${m.border}`, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            {m.icon}
          </div>
          {expanded && (
            <button onClick={(e) => { e.stopPropagation(); onSelect(); }} className="btn btn-ghost btn-sm" style={{ position: "relative", zIndex: 1, padding: 6 }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 8, position: "relative", zIndex: 1, color: "var(--text-primary)" }}>{m.label}</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: expanded ? 20 : 0, position: "relative", zIndex: 1 }}>{m.desc}</div>

        {!expanded && (
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ai)", display: "flex", alignItems: "center", gap: 6, position: "relative", zIndex: 1, marginTop: 16, opacity: 0, transform: "translateY(5px)", transition: "all 0.2s" }} className="group-hover:opacity-100 group-hover:translate-y-0">
            <Sparkles style={{ width: 14, height: 14 }} /> Configure Mission →
          </div>
        )}
      </div>

      {/* Config form */}
      {expanded && (
        <div style={{ padding: "0 24px 24px", position: "relative", zIndex: 1, background: "var(--bg-surface)", borderTop: "1px solid var(--border-subtle)", marginTop: -4, paddingTop: 20 }}>

          {/* Outbound Campaign */}
          {m.id === "outbound_campaign" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select contact (with email consent)</label>
                <select className="input select-styled" value={formData.contact || ""} onChange={(e) => setFormData({ ...formData, contact: e.target.value })}>
                  <option value="">Choose contact...</option>
                  {contacts.filter(c => c.consent_email).map(c => (
                    <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name} ({c.email})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="label">Campaign Goal</label>
                  <select className="input select-styled" value={formData.goal || ""} onChange={(e) => setFormData({ ...formData, goal: e.target.value })}>
                    <option value="first_touch">First Touch</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="re_engage">Re-engage</option>
                  </select>
                </div>
                <div>
                  <label className="label">Tone</label>
                  <select className="input select-styled" value={formData.tone || ""} onChange={(e) => setFormData({ ...formData, tone: e.target.value })}>
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Channel</label>
                <select className="input select-styled" value={formData.channel || "EMAIL"} onChange={(e) => setFormData({ ...formData, channel: e.target.value })}>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
            </>
          )}

          {/* Lead Qualification */}
          {m.id === "lead_qualification" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select contact</label>
                <select className="input select-styled" value={formData.contact || ""} onChange={(e) => setFormData({ ...formData, contact: e.target.value })}>
                  <option value="">Choose contact...</option>
                  {contacts.map(c => <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Additional context (optional)</label>
                <textarea className="input" rows={3} placeholder="Form submission data, notes..." value={formData.context || ""} onChange={(e) => setFormData({ ...formData, context: e.target.value })} style={{ resize: "vertical" }} />
              </div>
            </>
          )}

          {/* Deal Progression */}
          {m.id === "deal_progression" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select deal</label>
                <select className="input select-styled" value={formData.deal || ""} onChange={(e) => setFormData({ ...formData, deal: e.target.value })}>
                  <option value="">Choose deal...</option>
                  {deals.filter(d => d.stage?.name !== "Closed Won" && d.stage?.name !== "Closed Lost").map(d => (
                    <option key={d.id} value={d.name}>{d.name} — {d.stage?.name} — {formatCurrency(d.amount || 0)}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Goal</label>
                <select className="input select-styled" value={formData.goal || ""} onChange={(e) => setFormData({ ...formData, goal: e.target.value })}>
                  <option value="advance">Advance Stage</option>
                  <option value="reengage">Re-engage</option>
                  <option value="meeting">Schedule Meeting</option>
                </select>
              </div>
            </>
          )}

          {/* Account Research */}
          {m.id === "account_research" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select account</label>
                <select className="input select-styled" value={formData.account || ""} onChange={(e) => setFormData({ ...formData, account: e.target.value })}>
                  <option value="">Choose account...</option>
                  {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Research depth</label>
                <div style={{ display: "flex", gap: 12 }}>
                  {["Standard", "Deep"].map(d => (
                    <label key={d} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, background: "var(--bg-elevated)", padding: "10px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border-default)", flex: 1 }}>
                      <input type="radio" name="depth" value={d.toLowerCase()} checked={(formData.depth || "standard") === d.toLowerCase()} onChange={() => setFormData({ ...formData, depth: d.toLowerCase() })} style={{ accentColor: "var(--accent)" }} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Nurture Sequence */}
          {m.id === "nurture_sequence" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select contact or deal</label>
                <select className="input select-styled" value={formData.contact || ""} onChange={(e) => setFormData({ ...formData, contact: e.target.value })}>
                  <option value="">Choose...</option>
                  <optgroup label="Contacts">
                    {contacts.map(c => <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</option>)}
                  </optgroup>
                  <optgroup label="Deals">
                    {deals.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Sequence type</label>
                <select className="input select-styled" value={formData.seqType || ""} onChange={(e) => setFormData({ ...formData, seqType: e.target.value })}>
                  <option value="post_demo">Post-Demo</option>
                  <option value="post_proposal">Post-Proposal</option>
                  <option value="long_term">Long-term Nurture</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Channel</label>
                <select className="input select-styled" value={formData.channel || "EMAIL"} onChange={(e) => setFormData({ ...formData, channel: e.target.value })}>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
            </>
          )}

          {/* Opportunity Watch */}
          {m.id === "opportunity_watch" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select account to watch</label>
                <select className="input select-styled" value={formData.account || ""} onChange={(e) => setFormData({ ...formData, account: e.target.value })}>
                  <option value="">Choose account...</option>
                  {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Watch focus</label>
                <select className="input select-styled" value={formData.focus || "all"} onChange={(e) => setFormData({ ...formData, focus: e.target.value })}>
                  <option value="all">All signals</option>
                  <option value="expansion">Expansion signals</option>
                  <option value="leadership">Leadership changes</option>
                  <option value="tech">Technology changes</option>
                  <option value="renewal">Renewal / contract timing</option>
                </select>
              </div>
            </>
          )}

          {/* Generate Proposal */}
          {m.id === "generate_proposal" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select deal to generate proposal for</label>
                <select className="input select-styled" value={formData.deal || ""} onChange={(e) => setFormData({ ...formData, deal: e.target.value })}>
                  <option value="">Choose deal...</option>
                  {deals.filter(d => d.stage?.name !== "Closed Won" && d.stage?.name !== "Closed Lost").map(d => (
                    <option key={d.id} value={d.name}>{d.name} — {d.stage?.name} — {formatCurrency(d.amount || 0)}</option>
                  ))}
                </select>
              </div>
              <div style={{ background: "rgba(132,204,22,0.06)", border: "1px solid rgba(132,204,22,0.15)", borderRadius: "var(--r-md)", padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                Generates a full proposal with pricing table, implementation timeline, and next steps. Internal document — no approval needed.
              </div>
            </>
          )}

          {/* Schedule Meeting */}
          {m.id === "schedule_meeting" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select deal to schedule for</label>
                <select className="input select-styled" value={formData.deal || ""} onChange={(e) => setFormData({ ...formData, deal: e.target.value })}>
                  <option value="">Choose deal...</option>
                  {deals.filter(d => d.stage?.name !== "Closed Won" && d.stage?.name !== "Closed Lost").map(d => (
                    <option key={d.id} value={d.name}>{d.name} — {d.stage?.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Meeting type</label>
                <select className="input select-styled" value={formData.meetingType || "auto"} onChange={(e) => setFormData({ ...formData, meetingType: e.target.value })}>
                  <option value="auto">Auto (based on deal stage)</option>
                  <option value="discovery">Discovery Call</option>
                  <option value="demo">Product Demo</option>
                  <option value="proposal_review">Proposal Review</option>
                  <option value="negotiation">Negotiation</option>
                </select>
              </div>
              <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: "var(--r-md)", padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                Proposes 3 time slots and drafts a scheduling email. Goes to Approvals before anything sends.
              </div>
            </>
          )}

          <button
            className="btn btn-ai"
            style={{ width: "100%", justifyContent: "center", marginTop: 16, padding: "12px 16px", fontSize: 14 }}
            onClick={handleLaunch}
            disabled={!formData.contact && !formData.account && !formData.deal}
          >
            <Play style={{ width: 16, height: 16 }} /> {launchLabel[m.id] || "Launch"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Run Card ──────────────────────────────────────────────────
function RunCard({ run, onCancel }: { run: any; onCancel: () => void }) {
  const pct = run.totalSteps > 0 ? Math.round(((run.currentStep + (run.status === "running" ? 0.5 : 0)) / run.totalSteps) * 100) : 0;
  const [expanded, setExpanded] = useState(false);

  const dotColor = run.status === "running" ? "var(--ai)" : run.status === "complete" ? "var(--success)" : run.status === "cancelled" ? "var(--warning)" : "var(--error)";

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", padding: "18px 20px", marginBottom: 12, boxShadow: "var(--shadow-card)" }} className="anim-fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: run.status === "running" ? 16 : 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, flexShrink: 0 }} className={run.status === "running" ? "anim-pulse" : ""} />
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>{run.agentName}</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>{run.goal}</div>

        {run.status === "running" && <button className="btn btn-danger-ghost btn-sm" onClick={onCancel} title="Cancel"><StopCircle style={{ width: 16, height: 16 }} /></button>}
        {run.status === "complete" && <span className="pill pill-success">Complete</span>}
        {run.status === "cancelled" && <span className="pill pill-warning">Cancelled</span>}
        {run.status === "failed" && <span className="pill pill-error">Failed</span>}
      </div>

      {run.status === "running" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
              <Activity style={{ width: 14, height: 14, color: "var(--ai)" }} /> {run.stepLabel}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--ai)" }}>{Math.min(pct, 100)}%</span>
          </div>
          <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, #A78BFA, #38BDF8)", borderRadius: 3, width: `${Math.min(pct, 100)}%`, transition: "width 0.8s ease" }} />
          </div>
        </>
      )}

      {run.status !== "running" && (
        <button onClick={() => setExpanded(!expanded)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", padding: "6px 12px", cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.borderColor = "var(--border-default)"; }}
        >
          {expanded ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
          {expanded ? "Hide Trace" : "View Trace"}
        </button>
      )}
      {expanded && (
        <div style={{ marginTop: 12, padding: "12px 16px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", fontFamily: "var(--font-mono)" }}>
          {run.steps.map((step: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 11, color: "var(--text-secondary)", padding: "4px 0" }}>
              <span style={{ color: "var(--success)", fontSize: 12, marginTop: -2 }}>✓</span>
              <span style={{ lineHeight: 1.4 }}>{step.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AICommandPage() {
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { startRun, cancelRun } = useAgentSimulation();
  const agentRuns = useAppStore((s) => s.agentRuns);

  const { data: contactsRes } = useQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });
  const { data: accountsRes } = useQuery({ queryKey: ["accounts"], queryFn: () => accountsApi.list({}) });
  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });

  const contacts = contactsRes?.data?.items || [];
  const accounts = accountsRes?.data?.items || [];
  const deals = dealsRes?.data?.items || [];

  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(headerRef.current, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
    }
  }, []);

  useEffect(() => {
    if (cardsRef.current) {
      gsap.fromTo(cardsRef.current.children,
        { y: 30, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.06, ease: "power3.out", delay: 0.1 }
      );
    }
  }, [expandedMission]);

  const handleLaunch = (missionId: string, goal: string, entity?: string, channel?: string) => {
    setExpandedMission(null);
    startRun(missionId as any, goal, entity, { contacts, accounts, deals }, channel as any);
  };

  const runningCount = agentRuns.filter(r => r.status === "running").length;
  const completedRuns = agentRuns.filter(r => r.status !== "running").sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  const displayMissions = expandedMission ? MISSIONS.filter(m => m.id === expandedMission) : MISSIONS;

  return (
    <div className="page-wrapper">
      <div ref={headerRef} style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(56,189,248,0.1))", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot style={{ width: 22, height: 22, color: "var(--ai)" }} />
          </div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>AI Command Center</h1>
            <p className="page-subtitle" style={{ marginTop: 2 }}>
              8 specialized agents ready to work. All external drafts require your approval before sending.
            </p>
          </div>
          {runningCount > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 20, fontSize: 12, fontWeight: 600, color: "var(--ai)" }}>
              <Zap style={{ width: 12, height: 12 }} className="anim-pulse" />
              {runningCount} agent{runningCount > 1 ? "s" : ""} running
            </div>
          )}
        </div>
      </div>

      {/* Mission Grid */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 16, fontFamily: "var(--font-display)" }}>
          {expandedMission ? "Configure Mission" : `${MISSIONS.length} Available Missions`}
        </div>
        <div ref={cardsRef} style={{ display: "grid", gridTemplateColumns: expandedMission ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {displayMissions.map((m) => (
            <MissionCard
              key={m.id}
              m={m}
              expanded={expandedMission === m.id}
              onSelect={() => setExpandedMission(expandedMission === m.id ? null : m.id)}
              contacts={contacts}
              accounts={accounts}
              deals={deals}
              onLaunch={handleLaunch}
            />
          ))}
        </div>
      </div>

      {/* Active Runs */}
      {agentRuns.filter(r => r.status === "running").length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-header" style={{ marginBottom: 16 }}>
            <span className="section-title">Active Transmissions</span>
          </div>
          {agentRuns.filter(r => r.status === "running").map(run => (
            <RunCard key={run.id} run={run} onCancel={() => cancelRun(run.id)} />
          ))}
        </div>
      )}

      {/* Completed Runs */}
      {completedRuns.length > 0 && (
        <div>
          <div className="section-header" style={{ marginBottom: 16 }}>
            <span className="section-title">Execution Log</span>
          </div>
          {completedRuns.slice(0, 10).map(run => (
            <RunCard key={run.id} run={run} onCancel={() => {}} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {agentRuns.length === 0 && (
        <div style={{ background: "linear-gradient(180deg, var(--bg-card), var(--bg-surface))", border: "1px dashed var(--border-default)", borderRadius: "var(--r-xl)", padding: "64px 20px", textAlign: "center", marginTop: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(167,139,250,0.1)", color: "var(--ai)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 20px" }}>
            <Sparkles style={{ width: 32, height: 32 }} />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
            Systems Online. Awaiting Mission.
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 440, margin: "0 auto" }}>
            8 specialized agents ready — select any mission above to configure and launch.
          </div>
        </div>
      )}
    </div>
  );
}
