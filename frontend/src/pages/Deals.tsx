import React, { useRef, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dealsApi, contactsApi, accountsApi, type Deal, type Contact, type Account } from "../lib/api";
import { formatCurrency, formatRelativeTime, formatCloseDate } from "../lib/utils";
import { getDealMeta } from "../lib/seedData";
import gsap from "gsap";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from "@dnd-kit/core";
import { Edit2, Trash2, Calendar, Building2, User, AlertTriangle, FileText, Sparkles } from "lucide-react";
import Sheet from "../components/Sheet";
import { showToast } from "../components/Toast";
import { confirmAction } from "../components/ConfirmDialog";
import { useAgentSimulation } from "../lib/useAgentSimulation";
import { useAppStore } from "../lib/store";

const STAGES = [
  { name: "Lead", color: "var(--text-tertiary)" },
  { name: "Qualified", color: "var(--accent)" },
  { name: "Demo/Meeting", color: "#60A5FA" },
  { name: "Proposal", color: "var(--ai)" },
  { name: "Negotiation", color: "var(--warning)" },
  { name: "Closed Won", color: "var(--success)" },
  { name: "Closed Lost", color: "var(--error)" }
];

function DroppableColumn({ id, stage, total, count, children, quickAddStage, setQuickAddStage, onQuickAdd }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [newDealName, setNewDealName] = useState("");
  const [newDealAmount, setNewDealAmount] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealName) return;
    onQuickAdd({ name: newDealName, amount: parseFloat(newDealAmount) || 0, stage_id: stage.name });
    setNewDealName("");
    setNewDealAmount("");
    setQuickAddStage(null);
  };
  return (
    <div ref={setNodeRef} style={{
      minWidth: 230, maxWidth: 230, display: "flex", flexDirection: "column", gap: 8,
      transition: "background 0.2s",
      background: isOver ? "rgba(56,189,248,0.04)" : "transparent",
      borderRadius: "var(--r-lg)", padding: isOver ? 4 : 0,
    }}>
      <div style={{ padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: stage.color }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: stage.color }}>
            {stage.name === "Closed Won" ? "Won" : stage.name === "Closed Lost" ? "Lost" : stage.name}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{formatCurrency(total)}</div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{count}</div>
      </div>
      {children}
      
      {quickAddStage === stage.name ? (
        <form onSubmit={handleSubmit} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-accent)", borderRadius: "var(--r-md)", padding: 10, display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <input autoFocus placeholder="Deal Name..." className="input" value={newDealName} onChange={e => setNewDealName(e.target.value)} style={{ padding: "6px 8px", fontSize: 12, height: 30 }} />
          <input type="number" placeholder="Amount ($)..." className="input" value={newDealAmount} onChange={e => setNewDealAmount(e.target.value)} style={{ padding: "6px 8px", fontSize: 12, height: 30 }} />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickAddStage(null)} style={{ padding: "4px 8px", fontSize: 11, height: 24 }}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "4px 8px", fontSize: 11, height: 24 }}>Save</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setQuickAddStage(stage.name)} style={{ background: "none", border: "1px dashed var(--border-default)", borderRadius: "var(--r-md)", padding: "10px", color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer", transition: "all 0.2s", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.color = "var(--text-primary)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
          + Quick Add Deal
        </button>
      )}
    </div>
  );
}

function DraggableCard({ deal, stage, openEdit, handleDelete, openDetail }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const meta = getDealMeta(deal.name);
  const { dealInsights, winProbabilities } = useAppStore();
  const insight = dealInsights[deal.name];
  const winProb = winProbabilities[deal.name];
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999, opacity: 0.85 } : undefined;

  const isB2B = meta?.type === "B2B";
  const displayName = meta?.contactOrAccount || deal.name.split(" ")[0];
  const daysInStage = meta?.daysInStage ?? 0;
  const closeDate = meta?.closeDate || deal.expected_close_date;

  // Win probability from AI or fallback to deal.probability
  const displayWinProb = winProb?.probability ?? deal.probability;
  const winColor = displayWinProb >= 70 ? "var(--success)" : displayWinProb >= 40 ? "var(--warning)" : "var(--error)";

  return (
    <div ref={setNodeRef} style={{
      ...style,
      background: "var(--bg-card)", border: "1px solid var(--border-default)",
      borderRadius: "var(--r-md)", padding: 14, cursor: isDragging ? "grabbing" : "grab",
      borderLeft: `3px solid ${stage.color}`, position: "relative",
      transition: isDragging ? "none" : "all 0.2s",
    }} {...listeners} {...attributes} className="deal-card group">
      {/* AI Health indicator */}
      {insight && (
        <div style={{ position: "absolute", top: 6, right: 8, display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: insight.dealHealth === "healthy" ? "var(--success)" : insight.dealHealth === "at_risk" ? "var(--warning)" : "var(--error)",
            boxShadow: `0 0 6px ${insight.dealHealth === "healthy" ? "rgba(52,211,153,0.5)" : insight.dealHealth === "at_risk" ? "rgba(251,191,36,0.5)" : "rgba(248,113,113,0.5)"}`,
          }} />
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>{insight.healthScore}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, lineHeight: 1.3, cursor: "pointer", flex: 1 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => openDetail(deal)}>
          {deal.name}
        </div>
        <div style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }} className="group-hover:opacity-100">
          <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onPointerDown={(e) => e.stopPropagation()} onClick={() => openEdit(deal)}><Edit2 style={{width: 12, height: 12}} /></button>
          <button className="btn btn-danger-ghost btn-sm" style={{ padding: 4 }} onPointerDown={(e) => e.stopPropagation()} onClick={() => handleDelete(deal.id)}><Trash2 style={{width: 12, height: 12}} /></button>
        </div>
      </div>

      {/* Contact/Account line */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>
        {isB2B ? <Building2 style={{ width: 11, height: 11, color: "var(--text-tertiary)" }} /> : <User style={{ width: 11, height: 11, color: "var(--text-tertiary)" }} />}
        <span>{displayName}</span>
        <span style={{ fontSize: 9, color: "var(--text-tertiary)", marginLeft: 2 }}>({isB2B ? "B2B" : "B2C"})</span>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500, color: "var(--accent)", marginBottom: 6 }}>{formatCurrency(deal.amount || 0)}</div>

      {/* Close date */}
      {closeDate && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-tertiary)", marginBottom: 6 }}>
          <Calendar style={{ width: 10, height: 10 }} />
          <span style={{ fontFamily: "var(--font-mono)" }}>{formatCloseDate(closeDate)}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Win probability badge */}
        <span style={{
          fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "2px 7px", borderRadius: 10,
          background: winColor + "15", color: winColor, border: `1px solid ${winColor}30`,
          display: "flex", alignItems: "center", gap: 3,
        }}>
          {winProb ? "🎯" : ""} {displayWinProb}%{winProb ? " win" : ""}
        </span>

        {/* Days in stage warning */}
        {daysInStage > 7 && stage.name !== "Closed Won" && stage.name !== "Closed Lost" && (
          <span style={{
            fontSize: 9, fontWeight: 600, fontFamily: "var(--font-mono)", padding: "2px 7px", borderRadius: 10,
            background: "rgba(251,191,36,0.12)", color: "var(--warning)", border: "1px solid rgba(251,191,36,0.2)",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <AlertTriangle style={{ width: 9, height: 9 }} /> {daysInStage}d in stage
          </span>
        )}

        {daysInStage <= 7 && (
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{formatRelativeTime(deal.created_at)}</span>
        )}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const qc = useQueryClient();
  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });
  const { data: stagesRes } = useQuery({ queryKey: ["deal-stages"], queryFn: () => dealsApi.stages() });
  const [localDeals, setLocalDeals] = useState<Deal[]>([]);
  const backendStages = stagesRes?.data || [];

  useEffect(() => {
    if (dealsRes?.data?.items) {
      setLocalDeals(dealsRes.data.items);
    }
  }, [dealsRes]);

  const totalValue = localDeals.reduce((sum: number, d: Deal) => sum + (d.amount || 0), 0);
  const boardRef = useRef<HTMLDivElement>(null);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [quickAddStage, setQuickAddStage] = useState<string | null>(null);

  useEffect(() => {
    if (boardRef.current && localDeals.length > 0 && !editingDeal) {
      gsap.fromTo(boardRef.current.querySelectorAll('.deal-card'), { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: "power2.out" });
    }
  }, [dealsRes]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Deal>) => editingDeal ? dealsApi.update(editingDeal.id, data) : dealsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); setIsSheetOpen(false); showToast(editingDeal ? "Deal updated" : "Deal created", "success"); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dealsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); setIsSheetOpen(false); showToast("Deal deleted", "success"); }
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, stageName }: { id: string, stageName: string }) => {
      // Look up the real stage ID from the backend stages list
      const stageObj = backendStages.find((s: any) => s.name === stageName);
      if (stageObj) {
        return dealsApi.transitionStage(id, stageObj.id);
      }
      // Fallback: try using update with name (may not work with all backends)
      return dealsApi.update(id, { stage_id: stageName } as any);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); showToast("Deal moved to new stage", "success"); },
    onError: () => {
      // Revert local state on failure
      if (dealsRes?.data?.items) setLocalDeals(dealsRes.data.items);
      showToast("Failed to move deal", "error");
    },
  });

  const openEdit = (d: Deal) => { setEditingDeal(d); setIsSheetOpen(true); };
  const openCreate = () => { setEditingDeal(null); setIsSheetOpen(true); };
  const openDetail = (d: Deal) => { setDetailDeal(d); };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMutation.mutate({
      name: fd.get("name") as string,
      amount: parseFloat(fd.get("amount") as string),
      probability: parseInt(fd.get("probability") as string),
      expected_close_date: fd.get("close_date") as string || undefined,
      stage_id: fd.get("stage") as string
    });
  };

  const handleDelete = async (id: string, name?: string) => {
    const confirmed = await confirmAction({
      title: "Delete Deal",
      message: `Are you sure you want to delete "${name || 'this deal'}"? This action cannot be undone.`,
      confirmText: "Delete Deal",
      variant: "danger",
    });
    if (confirmed) deleteMutation.mutate(id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const dealId = active.id as string;
    const newStageName = over.id as string;
    const deal = localDeals.find(d => d.id === dealId);
    if (deal && deal.stage?.name !== newStageName) {
      // Optimistic local update
      setLocalDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: { ...d.stage, name: newStageName } } as Deal : d));
      transitionMutation.mutate({ id: dealId, stageName: newStageName });
    }
  };

  return (
    <div className="page-wrapper anim-fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Deals Pipeline</h1>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {localDeals.length} deals · <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{formatCurrency(totalValue)}</span> pipeline
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-primary" onClick={openCreate}>+ New Deal</button>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div 
          ref={boardRef} 
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16, minHeight: "calc(100vh - 220px)", position: "relative" }}
        >
          {STAGES.map(stage => {
            const stageDeals = localDeals.filter((d: Deal) => (d.stage?.name || "Lead") === stage.name);
            const stageTotal = stageDeals.reduce((sum: number, d: Deal) => sum + (d.amount || 0), 0);

            return (
              <DroppableColumn key={stage.name} id={stage.name} stage={stage} total={stageTotal} count={stageDeals.length} quickAddStage={quickAddStage} setQuickAddStage={setQuickAddStage} onQuickAdd={(data: any) => saveMutation.mutate({ ...data, probability: 50 })}>
                {stageDeals.map((deal: Deal) => (
                  <DraggableCard key={deal.id} deal={deal} stage={stage} openEdit={openEdit} handleDelete={handleDelete} openDetail={openDetail} />
                ))}
              </DroppableColumn>
            );
          })}
        </div>
      </DndContext>

      {/* EDIT/CREATE SHEET */}
      <Sheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editingDeal ? "Edit Deal" : "New Deal"}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label">Deal Name</label>
            <input name="name" defaultValue={editingDeal?.name} required className="input" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="label">Amount ($)</label>
              <input name="amount" type="number" defaultValue={editingDeal?.amount || ""} required className="input" />
            </div>
            <div>
              <label className="label">Probability (%)</label>
              <input name="probability" type="number" min="0" max="100" defaultValue={editingDeal?.probability || ""} required className="input" />
            </div>
          </div>
          <div>
            <label className="label">Expected Close Date</label>
            <input name="close_date" type="date" defaultValue={editingDeal?.expected_close_date?.split("T")[0] || ""} className="input" />
          </div>
          <div>
            <label className="label">Stage</label>
            <select name="stage" defaultValue={editingDeal?.stage?.name || "Lead"} className="input">
              {STAGES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsSheetOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Deal"}</button>
          </div>
        </form>
      </Sheet>

      {/* DEAL DETAIL SHEET — 5 TABS */}
      <Sheet isOpen={!!detailDeal} onClose={() => setDetailDeal(null)} title={detailDeal?.name || "Deal Detail"}>
        {detailDeal && <DealDetail deal={detailDeal} onEdit={() => { setDetailDeal(null); openEdit(detailDeal); }} />}
      </Sheet>
    </div>
  );
}

/* ─── Deal Detail Component with 5 Tabs ─── */
type DealTab = "overview" | "activity" | "tasks" | "documents" | "ai";

function DealDetail({ deal, onEdit }: { deal: Deal; onEdit: () => void }) {
  const [tab, setTab] = useState<DealTab>("overview");
  const meta = getDealMeta(deal.name);
  const { startRun } = useAgentSimulation();
  const { dealInsights, proposalDocuments, winProbabilities } = useAppStore();
  const insight = dealInsights[deal.name];
  const proposal = proposalDocuments[deal.name];
  const winProb = winProbabilities[deal.name];

  const qc = useQueryClient();
  const launchDealAI = () => {
    const deals = qc.getQueryData<{ data: { items: Deal[] } }>(["deals"])?.data.items || [];
    const contacts = qc.getQueryData<{ data: { items: Contact[] } }>(["contacts"])?.data.items || [];
    const accounts = qc.getQueryData<{ data: { items: Account[] } }>(["accounts"])?.data.items || [];
    
    startRun("deal_progression", `Progress deal: ${deal.name}`, deal.name, { deals, contacts, accounts });
    showToast(`✦ AI launched for ${deal.name}`, "ai");
  };
  const tabs: { key: DealTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "activity", label: "Activity" },
    { key: "tasks", label: "Tasks" },
    { key: "documents", label: "Documents" },
    { key: "ai", label: "AI Panel" },
  ];

  const seedActivities = [
    { icon: "✉️", title: "Welcome Email", desc: "Sent welcome email after form submission", time: "3d ago" },
    { icon: "📞", title: "Discovery Call", desc: "45min call, discussed requirements", time: "2d ago" },
    { icon: "📝", title: "Blocker Identified", desc: "Security concerns flagged by stakeholder", time: "2d ago" },
    { icon: "⚡", title: "Champion Engaged", desc: "Internal advocate will push forward", time: "1d ago" },
  ];
  const seedTasks = [
    { title: "Prepare demo environment", due: "Apr 25", status: "pending", ai: true },
    { title: "Send revised proposal", due: "Apr 28", status: "pending", ai: false },
  ];
  const seedDocs = [
    { name: "Requirements Brief.pdf", size: "245 KB", date: "Apr 20, 2026" },
    { name: "Demo Recording.mp4", size: "156 MB", date: "Apr 22, 2026" },
  ];
  const daysInStage = meta?.daysInStage || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="pill pill-neutral" style={{ fontSize: 11 }}>{deal.stage?.name || "Lead"}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{deal.probability}% probability</span>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, color: "var(--accent)" }}>{formatCurrency(deal.amount || 0)}</div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 14px", fontSize: 12, fontWeight: 500, background: "none", border: "none",
            color: tab === t.key ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer",
            borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
            transition: "all 0.2s", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--border-default)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "var(--font-display)" }}>
              {meta?.type === "B2B" ? "Account" : "Contact"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {meta?.type === "B2B" ? <Building2 style={{ width: 16, height: 16, color: "var(--accent)" }} /> : <User style={{ width: 16, height: 16, color: "var(--accent)" }} />}
              <span style={{ fontWeight: 600, fontSize: 15 }}>{meta?.contactOrAccount || "—"}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div><div className="label">Close Date</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{formatCloseDate(meta?.closeDate || deal.expected_close_date)}</div></div>
            <div><div className="label">Days in Stage</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: daysInStage > 7 ? "var(--warning)" : "var(--text-primary)" }}>{daysInStage} days</div></div>
            <div><div className="label">Created</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{formatRelativeTime(deal.created_at)}</div></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={onEdit}>Edit Deal</button>
            <button className="btn btn-ai" onClick={launchDealAI}>✦ Run AI on this deal</button>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {seedActivities.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: i < seedActivities.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, background: "var(--bg-elevated)" }}>{a.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.desc}</div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>{a.time}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "tasks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {seedTasks.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, border: "1.5px solid var(--text-tertiary)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Due: {t.due}</div>
              </div>
              {t.ai && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "rgba(167,139,250,0.1)", color: "var(--ai)" }}>✦ AI</span>}
              <span className="pill pill-neutral" style={{ fontSize: 10 }}>{t.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {seedDocs.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <FileText style={{ width: 16, height: 16, color: "var(--accent)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{d.size} · {d.date}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => showToast("Download started", "success")}>Download</button>
            </div>
          ))}
        </div>
      )}

      {tab === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {insight ? (
            <>
              {/* Health Score Card */}
              <div style={{
                background: insight.dealHealth === "healthy" ? "rgba(52,211,153,0.06)" : insight.dealHealth === "at_risk" ? "rgba(251,191,36,0.06)" : "rgba(248,113,113,0.06)",
                borderRadius: "var(--r-md)", padding: 16,
                border: `1px solid ${insight.dealHealth === "healthy" ? "rgba(52,211,153,0.2)" : insight.dealHealth === "at_risk" ? "rgba(251,191,36,0.2)" : "rgba(248,113,113,0.2)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)", color: insight.dealHealth === "healthy" ? "var(--success)" : insight.dealHealth === "at_risk" ? "var(--warning)" : "var(--error)" }}>
                    📊 AI Deal Analysis
                  </div>
                  <span style={{
                    padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)",
                    background: insight.dealHealth === "healthy" ? "var(--success)" : insight.dealHealth === "at_risk" ? "var(--warning)" : "var(--error)",
                    color: "#fff",
                  }}>
                    {insight.healthScore}/100 · {insight.dealHealth.toUpperCase().replace("_", " ")}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>{insight.analysis}</div>
                {insight.stalledReason && (
                  <div style={{ fontSize: 12, color: "var(--warning)", marginBottom: 8 }}>⚠ Stalled: {insight.stalledReason}</div>
                )}
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Win Assessment: {insight.winProbabilityAssessment}</div>
              </div>

              {/* Win Probability + Sparkline */}
              {winProb && (
                <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--border-default)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)" }}>🎯 Win Probability</div>
                    <span style={{
                      padding: "2px 10px", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)",
                      background: winProb.probability >= 70 ? "var(--success)" : winProb.probability >= 40 ? "var(--warning)" : "var(--error)",
                      color: "#fff",
                    }}>
                      {winProb.probability}%
                    </span>
                  </div>

                  {/* SVG Sparkline */}
                  {winProb.history.length > 1 && (() => {
                    const h = winProb.history;
                    const w = 200, ht = 40;
                    const minV = Math.max(0, Math.min(...h) - 10);
                    const maxV = Math.min(100, Math.max(...h) + 10);
                    const range = maxV - minV || 1;
                    const points = h.map((v, i) => {
                      const x = (i / (h.length - 1)) * w;
                      const y = ht - ((v - minV) / range) * ht;
                      return `${x},${y}`;
                    }).join(" ");
                    const gradId = `spark-${deal.id}`;
                    const trendUp = h[h.length - 1] >= h[0];
                    const lineColor = trendUp ? "var(--success)" : "var(--error)";
                    return (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4 }}>Trend (last {h.length} updates)</div>
                        <svg width={w} height={ht + 4} viewBox={`0 -2 ${w} ${ht + 4}`} style={{ overflow: "visible" }}>
                          <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
                              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <polygon points={`0,${ht} ${points} ${w},${ht}`} fill={`url(#${gradId})`} />
                          <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {h.map((v, i) => {
                            const x = (i / (h.length - 1)) * w;
                            const y = ht - ((v - minV) / range) * ht;
                            return <circle key={i} cx={x} cy={y} r="3" fill={lineColor} stroke="var(--bg-card)" strokeWidth="1.5" />;
                          })}
                        </svg>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", marginTop: 2 }}>
                          {h.map((v, i) => <span key={i}>{v}%</span>)}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Probability Factors */}
                  {winProb.factors?.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Contributing Factors</div>
                      {winProb.factors.map((f: string, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2, paddingLeft: 4 }}>▸ {f}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Immediate Actions */}
              {insight.immediateActions && insight.immediateActions.length > 0 && (
                <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--border-default)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: "var(--font-display)" }}>Recommended Actions</div>
                  {insight.immediateActions.map((a: any, i: number) => {
                    const urgColor = a.urgency === "high" ? "var(--error)" : a.urgency === "medium" ? "var(--warning)" : "var(--text-tertiary)";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: i < insight.immediateActions.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${urgColor}15`, color: urgColor, textTransform: "uppercase", flexShrink: 0, marginTop: 2 }}>{a.urgency}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{a.action}</div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.reason}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, fontFamily: "var(--font-display)" }}>Suggested Next Steps</div>
              {[
                daysInStage > 7 ? `💡 Deal has been in ${deal.stage?.name} for ${daysInStage} days. Consider running AI analysis.` : null,
                `💡 ${meta?.contactOrAccount || "Key stakeholder"} hasn't been contacted recently.`,
              ].filter(Boolean).map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>{s}</div>
              ))}
            </div>
          )}

          {/* Proposal section */}
          {proposal && (
            <div style={{ background: "rgba(167,139,250,0.04)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid rgba(167,139,250,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ai)", textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)" }}>📄 AI Proposal</div>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>ACV: ${proposal.totalAcv.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{proposal.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>{proposal.executiveSummary}</div>
              {proposal.pricingTable && (
                <div style={{ borderTop: "1px solid rgba(167,139,250,0.1)", paddingTop: 8 }}>
                  {proposal.pricingTable.map((item: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", padding: "3px 0" }}>
                      <span>{item.item} (×{item.qty})</span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>${item.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="btn btn-ai" style={{ width: "100%", justifyContent: "center" }} onClick={launchDealAI}>
            ✦ Run AI on this deal
          </button>
        </div>
      )}
    </div>
  );
}
