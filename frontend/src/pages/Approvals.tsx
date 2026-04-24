import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAppStore } from "../lib/store";
import { ChevronDown, ChevronUp } from "lucide-react";
import { showToast } from "../components/Toast";
import { sendEmail, sendSMS } from "../lib/ai/messagingService";
import { activitiesApi } from "../lib/api";
import gsap from "gsap";

type ComplianceStatus = "pass" | "warn" | "fail";
type ComplianceRule = { rule: string; status: ComplianceStatus; detail: string };

export default function ApprovalsPage() {
  const { approvalsList, setApprovalsList } = useAppStore();
  const activeApprovals = approvalsList.filter(a => !a.dismissed);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [honestyChecked, setHonestyChecked] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [editingSubject, setEditingSubject] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const current = activeApprovals[selectedIdx] || null;

  // Reset state when selection changes
  useEffect(() => {
    if (current) {
      setEditedBody(current.body);
      setEditedSubject(current.subject);
      setHonestyChecked(false);
      setReasoningOpen(false);
      setEditMode(false);
      setEditingSubject(false);
    }
  }, [selectedIdx, current?.id]);

  // Compliance analysis
  const hasAnyFail = current?.compliance.some((c: any) => (c.status as ComplianceStatus) === "fail") || false;
  const hasHonestyWarn = current?.compliance.some((c: any) => c.rule === "Honesty Check" && c.status === "warn") || false;
  const canApprove = !hasAnyFail && (!hasHonestyWarn || honestyChecked);

  const wordCount = editedBody.split(/\s+/).filter(Boolean).length;

  const handleApprove = () => {
    setConfirmOpen(true);
  };

  const confirmApprove = async () => {
    if (!current) return;
    setSending(true);

    try {
      let result;
      if (current.type === "EMAIL" && current.contactEmail) {
        result = await sendEmail(current.contactEmail, editedSubject || current.subject, editedBody || current.body);
      } else if (current.type === "SMS" && current.contactPhone) {
        result = await sendSMS(current.contactPhone, editedBody || current.body);
      } else {
        throw new Error(`Missing ${current.type === "EMAIL" ? "email" : "phone"} for ${current.contactName}`);
      }

      setSending(false);
      setConfirmOpen(false);

      if (result.success) {
        setApprovalsList(approvalsList.map(a => a.id === current.id ? { ...a, dismissed: true } : a));
        const channel = current.type === "EMAIL" ? current.contactEmail : current.contactPhone;
        showToast(`✓ ${current.type} sent to ${current.contactName} (${channel})`, "success");

        try {
          await activitiesApi.create({
            type: current.type === "EMAIL" ? "email" : "sms",
            subject: `AI-drafted ${current.type.toLowerCase()} sent`,
            body: current.subject || current.body.slice(0, 100),
            ai_generated: true,
          });
        } catch { /* non-critical */ }

        setSelectedIdx(0);
      } else {
        showToast(`Send failed: ${result.error || "Unknown error"}`, "error");
      }
    } catch (e: any) {
      setSending(false);
      setConfirmOpen(false);
      showToast(`Send failed: ${e.message}`, "error");
    }
  };

  const handleReject = () => {
    setRejectModalOpen(true);
  };

  const confirmReject = () => {
    setRejectModalOpen(false);
    setRejectFeedback("");
    setApprovalsList(approvalsList.map(a => a.id === current?.id ? { ...a, dismissed: true } : a));
    setSelectedIdx(0);
    showToast("Draft rejected — feedback sent to agent", "warning");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (rejectModalOpen || confirmOpen || editMode) return;
      if (e.key === "a" || e.key === "A") { if (canApprove) handleApprove(); }
      if (e.key === "r" || e.key === "R") handleReject();
      if (e.key === "e" || e.key === "E") setEditMode(true);
      if (e.key === "ArrowUp") setSelectedIdx(Math.max(0, selectedIdx - 1));
      if (e.key === "ArrowDown") setSelectedIdx(Math.min(activeApprovals.length - 1, selectedIdx + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIdx, activeApprovals.length, canApprove, rejectModalOpen, confirmOpen, editMode]);

  if (activeApprovals.length === 0) {
    return (
      <div className="page-wrapper anim-fade-up">
        <div className="page-header"><div><h1 className="page-title">AI Approvals</h1><p className="page-subtitle">All caught up!</p></div></div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No pending approvals</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>All AI-generated drafts have been reviewed. Check back later or launch new AI missions.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Approvals</h1>
          <p className="page-subtitle">{activeApprovals.length} draft{activeApprovals.length !== 1 ? "s" : ""} awaiting your review</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, height: "calc(100vh - 180px)" }}>
        {/* LIST PANEL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
          {activeApprovals.map((a, idx) => (
            <div key={a.id} onClick={() => setSelectedIdx(idx)}
              style={{
                background: selectedIdx === idx ? "var(--bg-active)" : "var(--bg-card)",
                border: `1px solid ${selectedIdx === idx ? "var(--border-accent)" : "var(--border-default)"}`,
                borderRadius: "var(--r-md)", padding: 14, cursor: "pointer", transition: "all 0.15s", position: "relative",
                boxShadow: selectedIdx === idx ? "0 0 16px var(--accent-glow)" : "none",
              }}>
              {selectedIdx !== idx && (
                <div style={{ position: "absolute", top: 14, right: 14, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} className="ai-pulse" />
              )}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontFamily: "var(--font-mono)",
                background: a.type === "EMAIL" ? "rgba(56,189,248,0.1)" : "rgba(52,211,153,0.1)",
                color: a.type === "EMAIL" ? "var(--accent)" : "var(--success)",
                border: `1px solid ${a.type === "EMAIL" ? "rgba(56,189,248,0.2)" : "rgba(52,211,153,0.2)"}`,
              }}>
                {a.type === "EMAIL" ? "✉ Email" : "💬 SMS"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{a.contactName} · {a.companyName}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
                {a.type === "EMAIL" ? `✉ ${a.contactEmail}` : `💬 ${a.contactPhone || "No phone"}`}
                {a.type === "EMAIL" && a.contactPhone ? ` · 📱 ${a.contactPhone}` : ""}
                {a.type === "SMS" && a.contactEmail ? ` · ✉ ${a.contactEmail}` : ""}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{a.body.slice(0, 120)}...</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: a.expiresUrgent ? "var(--error)" : "var(--text-tertiary)" }}>
                ⏱ {a.expiresIn} remaining
              </div>
            </div>
          ))}
        </div>

        {/* DETAIL PANEL */}
        {current && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 14 }}>
              <div className="avatar av-5" style={{ width: 40, height: 40, borderRadius: 10, fontSize: 13 }}>{current.contactName.split(" ").map((n: string) => n[0]).join("")}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-display)" }}>{current.contactName}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {current.type === "EMAIL" ? `✉ ${current.contactEmail}` : `💬 ${current.contactPhone || "No phone"}`}
                  {current.contactPhone && current.type === "EMAIL" ? ` · 📱 ${current.contactPhone}` : ""}
                  {current.contactEmail && current.type === "SMS" ? ` · ✉ ${current.contactEmail}` : ""}
                  {" · "}{current.companyName}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{current.dealName}</div>
                  <div style={{ fontSize: 11, color: "var(--ai)", display: "flex", alignItems: "center", gap: 4 }}>✦ Drafted by {current.agentName}</div>
                </div>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 500, background: "rgba(96,165,250,0.1)", color: "#60A5FA" }}>{current.dealStage}</span>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {/* SMS phone bubble style */}
              {current.type === "SMS" ? (
                <>
                  <div style={{ background: "var(--bg-elevated)", border: `1px solid ${editMode ? "var(--border-accent)" : "var(--border-default)"}`, borderRadius: 24, padding: 20, maxWidth: 340, margin: "0 auto 16px", transition: "border-color 0.2s" }}>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginBottom: 12, fontFamily: "var(--font-mono)" }}>{current.contactName}</div>
                    <div style={{ background: "rgba(56,189,248,0.12)", borderRadius: "16px 16px 4px 16px", padding: "10px 14px", marginBottom: 8 }}>
                      {editMode ? (
                        <textarea value={editedBody} onChange={(e) => setEditedBody(e.target.value)}
                          maxLength={160}
                          style={{ width: "100%", minHeight: 60, background: "transparent", border: "none", color: "var(--text-primary)", fontSize: 13, lineHeight: 1.5, outline: "none", resize: "none", fontFamily: "var(--font-body)" }} />
                      ) : (
                        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, cursor: "pointer" }} onClick={() => setEditMode(true)}>
                          {editedBody}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", textAlign: "right" }}>From: Acufy Sales</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {editMode ? "✏ Editing SMS — changes will be reviewed" : "✏ Click the bubble to edit"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{editedBody.length} characters</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Email preview */}
                  <div style={{ background: "var(--bg-elevated)", border: `1px solid ${editMode ? "var(--border-accent)" : "var(--border-default)"}`, borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: 16, transition: "border-color 0.2s" }}>
                    {/* Subject */}
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, width: 50, flexShrink: 0 }}>Subject</span>
                      {editingSubject ? (
                        <input className="input" value={editedSubject} onChange={(e) => setEditedSubject(e.target.value)} onBlur={() => setEditingSubject(false)} autoFocus style={{ flex: 1, padding: "4px 8px", fontSize: 13 }} />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, flex: 1, cursor: "pointer" }} onClick={() => { setEditingSubject(true); setEditMode(true); }}>
                          {editedSubject} <span style={{ fontSize: 10, color: "var(--text-tertiary)", opacity: 0.5 }}>✏</span>
                        </span>
                      )}
                    </div>
                    {/* Body */}
                    <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, minHeight: 140 }}>
                      {editMode ? (
                        <textarea value={editedBody} onChange={(e) => setEditedBody(e.target.value)}
                          style={{ width: "100%", minHeight: 180, background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, outline: "none", resize: "vertical", fontFamily: "var(--font-body)" }} />
                      ) : (
                        <div style={{ whiteSpace: "pre-wrap", cursor: "pointer" }} onClick={() => setEditMode(true)}>
                          {editedBody}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edit mode indicators */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {editMode ? "✏ Editing — changes will be reviewed" : "✏ Click anywhere in the email body to edit"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{wordCount} words</span>
              </div>
                </>
              )}

              {/* Compliance */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontFamily: "var(--font-display)" }}>🛡 Compliance Check — Universal Pack v1.0</div>
                {current.compliance.map((rule: any, i: number) => {
                  const isPass = rule.status === "pass";
                  const isWarn = rule.status === "warn";
                  const isFail = (rule.status as ComplianceStatus) === "fail";
                  const bg = isPass ? "rgba(52,211,153,0.05)" : isWarn ? "rgba(251,191,36,0.05)" : "rgba(248,113,113,0.05)";
                  const border = isPass ? "rgba(52,211,153,0.1)" : isWarn ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)";
                  const iconBg = isPass ? "rgba(52,211,153,0.15)" : isWarn ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)";
                  const iconColor = isPass ? "var(--success)" : isWarn ? "var(--warning)" : "var(--error)";
                  const icon = isPass ? "✓" : isWarn ? "⚠" : "✕";
                  const label = isPass ? "Pass" : isWarn ? "Warn" : "Fail";

                  return (
                    <div key={i}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: "var(--r-sm)", marginBottom: 4, background: bg, border: `1px solid ${border}` }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0, background: iconBg, color: iconColor }}>{icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{rule.rule}</div>
                          {(isWarn || isFail) && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{rule.detail}</div>}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", color: iconColor }}>{label}</div>
                      </div>

                      {/* Honesty check requires checkbox */}
                      {isWarn && rule.rule === "Honesty Check" && (
                        <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: "var(--r-md)", padding: 12, marginTop: 4, marginBottom: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                            <input type="checkbox" checked={honestyChecked} onChange={(e) => setHonestyChecked(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--warning)" }} />
                            <span>I confirm this claim is accurate and I take responsibility. This acknowledgment will be logged.</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* AI Reasoning */}
              <div onClick={() => setReasoningOpen(!reasoningOpen)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", cursor: "pointer", marginBottom: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                <span>💭</span> Why did the AI draft this?
                {reasoningOpen ? <ChevronUp style={{ width: 12, height: 12, marginLeft: "auto" }} /> : <ChevronDown style={{ width: 12, height: 12, marginLeft: "auto" }} />}
              </div>
              {reasoningOpen && (
                <div className="anim-fade-up" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: 14, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {current.reasoning}
                </div>
              )}
            </div>

            {/* ACTION BAR */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8, background: "var(--bg-elevated)" }}>
              <button className="btn btn-danger-ghost btn-sm" onClick={handleReject}>✕ Reject</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(!editMode)}>
                {editMode ? "Done Editing" : "↩ Edit & Re-check"}
              </button>
              <div style={{ flex: 1 }} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", marginRight: 8 }}>
                <span style={{ opacity: 0.6 }}>A</span>pprove · <span style={{ opacity: 0.6 }}>R</span>eject · <span style={{ opacity: 0.6 }}>E</span>dit · ↑↓
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--warning)", display: "flex", alignItems: "center", gap: 4, marginRight: 4 }}>⏱ {current.expiresIn}</div>
              <div className="tooltip-wrap">
                <button className="btn btn-primary" disabled={!canApprove} onClick={handleApprove} style={{ opacity: canApprove ? 1 : 0.4 }}>
                  ✓ Approve & Send
                </button>
                {!canApprove && (
                  <div className="tooltip">
                    {hasAnyFail ? "Cannot approve — compliance violation" : "Check the honesty confirmation"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* REJECT MODAL */}
      {rejectModalOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(6,10,16,0.7)", zIndex: 2000 }} onClick={() => setRejectModalOpen(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", padding: 24, zIndex: 2001, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} className="anim-fade-up">
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Reject Draft</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>Send this draft back to the AI with your feedback. The agent will revise and resubmit.</p>
            <textarea className="input" rows={4} placeholder="Explain what needs to change..." value={rejectFeedback} onChange={(e) => setRejectFeedback(e.target.value)} style={{ resize: "vertical", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setRejectModalOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmReject}>Reject & Send Back</button>
            </div>
          </div>
        </>
      )}

      {/* CONFIRM MODAL */}
      {confirmOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(6,10,16,0.7)", zIndex: 2000 }} onClick={() => !sending && setConfirmOpen(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", padding: 24, zIndex: 2001, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} className="anim-fade-up">
            {sending ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div className="anim-spin" style={{ fontSize: 28, display: "inline-block", marginBottom: 12 }}>✦</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>Sending...</div>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Confirm Send</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  Send this {current?.type === "SMS" ? "SMS" : "email"} to <strong>{current?.contactName}</strong> at <strong>{current?.type === "SMS" ? current?.contactPhone : current?.contactEmail}</strong>?
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={confirmApprove}>Confirm & Send</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
