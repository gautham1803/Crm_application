import React, { useRef, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsApi, contactsApi, dealsApi, type Account } from "../lib/api";
import { formatCurrency, formatRelativeTime } from "../lib/utils";
import gsap from "gsap";
import { Search, Building2, User, Briefcase, Sparkles } from "lucide-react";
import Sheet from "../components/Sheet";
import { showToast } from "../components/Toast";
import { confirmAction } from "../components/ConfirmDialog";
import { useAgentSimulation } from "../lib/useAgentSimulation";
import { useAppStore } from "../lib/store";

export default function AccountsPage() {
  const qc = useQueryClient();
  const { startRun: startRunMain } = useAgentSimulation();
  const { data: accountsRes } = useQuery({ queryKey: ["accounts"], queryFn: () => accountsApi.list({}) });
  const { data: contactsRes } = useQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });
  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });
  const accounts = accountsRes?.data?.items || [];
  const contacts = contactsRes?.data?.items || [];
  const deals = dealsRes?.data?.items || [];
  const gridRef = useRef<HTMLDivElement>(null);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (gridRef.current) gsap.fromTo(gridRef.current.children, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: "power2.out" });
  }, [accounts.length]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Account>) => editingAccount ? accountsApi.update(editingAccount.id, data) : accountsApi.create(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setIsSheetOpen(false);
      showToast(editingAccount ? "Account updated" : "Account created", "success");
      if (!editingAccount && vars.name) {
        startRunMain("account_research", `Research ${vars.name}`, vars.name, { contacts, accounts, deals });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); setIsSheetOpen(false); showToast("Account deleted", "success"); }
  });

  const openEdit = (a: Account) => { setEditingAccount(a); setIsSheetOpen(true); };
  const openDetail = (a: Account) => { setDetailAccount(a); };
  const openCreate = () => { setEditingAccount(null); setIsSheetOpen(true); };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMutation.mutate({
      name: fd.get("name") as string,
      domain: fd.get("domain") as string,
      industry: fd.get("industry") as string,
      size: fd.get("size") as string,
      annual_revenue: fd.get("revenue") ? parseInt(fd.get("revenue") as string) : 0
    });
  };

  const handleDelete = async () => {
    if (!editingAccount) return;
    const confirmed = await confirmAction({
      title: "Delete Account",
      message: `Are you sure you want to delete "${editingAccount.name}"? All associated contacts and deals will be unlinked.`,
      confirmText: "Delete Account",
      variant: "danger",
    });
    if (confirmed) deleteMutation.mutate(editingAccount.id);
  };

  const filteredAccounts = searchQuery
    ? accounts.filter((a: Account) => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.industry || "").toLowerCase().includes(searchQuery.toLowerCase()))
    : accounts;

  return (
    <div className="page-wrapper anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">{accounts.length} companies</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Account</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, position: "relative", maxWidth: 360 }}>
        <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-tertiary)" }} />
        <input type="text" placeholder="Search accounts..." className="input" style={{ paddingLeft: 36 }}
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {filteredAccounts.map((acc: Account, i: number) => {
          const contactsCount = contacts.filter((c: any) => c.account_id === acc.id).length;
          const dealsCount = deals.filter((d: any) => d.account_id === acc.id).length;

          return (
            <div key={acc.id} className="card card-lift" style={{ cursor: "pointer", position: "relative" }} onClick={() => openDetail(acc)}>
              {/* On-hover AI button */}
              <button className="btn btn-ai btn-sm" title="✦ Run AI Research"
                onClick={(e) => { e.stopPropagation(); startRunMain("account_research", `Research: ${acc.name}`, acc.name, { contacts, accounts, deals }); showToast(`✦ AI research launched for ${acc.name}`, "ai"); }}
                style={{ position: "absolute", top: 10, right: 10, opacity: 0, transition: "opacity 0.15s", padding: "4px 8px", fontSize: 11 }}>
                <Sparkles style={{ width: 12, height: 12 }} />
              </button>
              <div className={`avatar av-${i % 8}`} style={{ width: 44, height: 44, borderRadius: 12, fontSize: 14, marginBottom: 12 }}>
                {acc.name.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{acc.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 10 }}>🌐 {acc.domain || "website.com"}</div>

              {/* Industry + Size badges */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                  {acc.industry || "Technology"}
                </span>
                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                  {acc.size || "—"}
                </span>
              </div>

              {/* Revenue */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: "var(--accent)", marginBottom: 8 }}>
                {formatCurrency(acc.annual_revenue || 0)}
              </div>

              {/* Contacts + Deals meta */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)" }}>
                <span>{contactsCount} contacts · {dealsCount} deal{dealsCount !== 1 ? "s" : ""}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{formatRelativeTime(acc.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editingAccount ? "Edit Account" : "New Account"}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label">Company Name</label>
            <input name="name" defaultValue={editingAccount?.name} required className="input" />
          </div>
          <div>
            <label className="label">Domain (Website)</label>
            <input name="domain" defaultValue={editingAccount?.domain || ""} className="input" placeholder="example.com" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="label">Industry</label>
              <input name="industry" defaultValue={editingAccount?.industry || ""} className="input" />
            </div>
            <div>
              <label className="label">Company Size</label>
              <select name="size" defaultValue={editingAccount?.size || ""} className="input">
                <option value="">Select size</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="501-1000">501-1000</option>
                <option value="1001+">1001+</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Annual Revenue</label>
            <input name="revenue" type="number" defaultValue={editingAccount?.annual_revenue || ""} className="input" />
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            {editingAccount && (
               <button type="button" className="btn btn-danger-ghost" onClick={handleDelete} style={{ marginRight: "auto" }}>Delete</button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setIsSheetOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Account"}</button>
          </div>
        </form>
      </Sheet>

      {/* ACCOUNT DETAIL SHEET — 4 TABS */}
      <Sheet isOpen={!!detailAccount} onClose={() => setDetailAccount(null)} title={detailAccount?.name || "Account Detail"}>
        {detailAccount && <AccountDetail account={detailAccount} onEdit={() => { setDetailAccount(null); openEdit(detailAccount); }} onDelete={() => {
          accountsApi.delete(detailAccount.id).then(() => {
            qc.invalidateQueries({ queryKey: ["accounts"] });
            setDetailAccount(null);
            showToast("Account deleted successfully", "success");
          }).catch(() => showToast("Failed to delete account", "error"));
        }} />}
      </Sheet>
    </div>
  );
}

/* ─── Account Detail Component with Real Data ─── */
type AccountTab = "overview" | "contacts" | "deals" | "documents";

function AccountDetail({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
  const [tab, setTab] = useState<AccountTab>("overview");
  const { startRun } = useAgentSimulation();
  const { researchResults, competitorIntel, expansionSignals } = useAppStore();
  const qc = useQueryClient();

  // Real data from API
  const { data: contactsRes } = useQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });
  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });
  const allContacts = contactsRes?.data?.items || [];
  const allDeals = dealsRes?.data?.items || [];

  const acctContacts = allContacts.filter((c: any) => c.account_id === account.id);
  const acctDeals = allDeals.filter((d: any) => d.account_id === account.id);

  // Add contact state
  const [showAddContact, setShowAddContact] = useState(false);
  const [addMode, setAddMode] = useState<"link" | "new">("link");
  const [linkContactId, setLinkContactId] = useState("");
  const [newContactForm, setNewContactForm] = useState({ first_name: "", last_name: "", email: "", phone: "", consent_email: true, consent_sms: false });

  const unlinkedContacts = allContacts.filter((c: any) => !c.account_id || c.account_id !== account.id);

  const linkMutation = useMutation({
    mutationFn: (contactId: string) => contactsApi.update(contactId, { account_id: account.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setShowAddContact(false);
      setLinkContactId("");
      showToast("Contact linked to account", "success");
    },
  });

  const createAndLinkMutation = useMutation({
    mutationFn: (data: any) => contactsApi.create({ ...data, account_id: account.id }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      setShowAddContact(false);
      setNewContactForm({ first_name: "", last_name: "", email: "", phone: "", consent_email: true, consent_sms: false });
      showToast("Contact created and linked", "success");

      // Auto-trigger welcome email
      if (res?.data) {
          const freshContacts = await qc.fetchQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });
          const freshList = freshContacts?.data?.items || [];
          if (!freshList.find((c: any) => c.id === res.data.id)) {
              freshList.push(res.data);
          }
          startRun("nurture_sequence", `Welcome email for ${newContactForm.first_name}`, res.data.id, { contacts: freshList, accounts: [account] as any, deals: allDeals });
      }
    },
  });

  const launchAccountAI = () => {
    startRun("account_research", `Research account: ${account.name}`, account.name, { contacts: allContacts, accounts: [account] as any, deals: allDeals });
    showToast(`✦ AI research launched for ${account.name}`, "ai");
  };

  const tabs: { key: AccountTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "contacts", label: `Contacts (${acctContacts.length})` },
    { key: "deals", label: `Deals (${acctDeals.length})` },
    { key: "documents", label: "Documents" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
          {account.name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>{account.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>🌐 {account.domain || "website.com"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "rgba(96,165,250,0.1)", color: "#60A5FA" }}>{account.industry || "Technology"}</span>
        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>{account.size || "—"}</span>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: "var(--accent)" }}>{formatCurrency(account.annual_revenue || 0)}</div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0, marginTop: 8 }}>
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
          <div style={{ display: "flex", gap: 20 }}>
            <div><div className="label">Total Contacts</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500 }}>{acctContacts.length}</div></div>
            <div><div className="label">Total Deals</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500 }}>{acctDeals.length}</div></div>
            <div><div className="label">Pipeline Value</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500 }}>{formatCurrency(acctDeals.reduce((s: number, d: any) => s + (d.amount || 0), 0))}</div></div>
            <div><div className="label">Created</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{formatRelativeTime(account.created_at)}</div></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={onEdit}>Edit Account</button>
            <button className="btn btn-danger-ghost" onClick={async () => {
              const confirmed = await confirmAction({
                title: "Delete Account",
                message: `Are you sure you want to delete ${account.name}? This action cannot be undone.`,
                variant: "danger",
              });
              if (confirmed) onDelete();
            }}>Delete</button>
            <button className="btn btn-ai" onClick={launchAccountAI}>✦ Run Account Research</button>
          </div>

          {/* AI Research Intel */}
          {(() => {
            const research = researchResults[account.name];
            if (!research) return null;
            const sections = [
              { label: "Company Overview", content: research.companyOverview, icon: "🏬" },
              { label: "Growth Signals", content: research.growthSignals, icon: "📈" },
              { label: "Buying Signals", content: research.buyingSignals, icon: "🛢️" },
              { label: "Tech Stack", content: research.techStack, icon: "⚙️" },
              { label: "Potential Objections", content: research.potentialObjections, icon: "⚠️" },
              { label: "Risk Factors", content: research.riskFactors, icon: "🛡️" },
            ].filter(s => s.content);
            return (
              <div style={{ background: "rgba(56,189,248,0.04)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid rgba(56,189,248,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)" }}>🔍 AI Research Intel</div>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>via ResearchAgent</span>
                </div>
                {sections.map((s, i) => (
                  <div key={i} style={{ marginBottom: i < sections.length - 1 ? 12 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{s.icon} {s.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, paddingLeft: 4 }}>{s.content}</div>
                  </div>
                ))}
                {research.talkingPoints && research.talkingPoints.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(56,189,248,0.1)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>💬 Talking Points</div>
                    {research.talkingPoints.map((tp: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 3, paddingLeft: 4 }}>• {tp}</div>
                    ))}
                  </div>
                )}
                {research.recommendedNextAction && (
                  <div style={{ marginTop: 10, fontSize: 11, color: "var(--accent)", fontWeight: 600, borderTop: "1px solid rgba(56,189,248,0.1)", paddingTop: 8 }}>
                    ➡ {research.recommendedNextAction}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Competitor Intel Panel */}
          {(() => {
            const intel = competitorIntel[account.name];
            if (!intel || !intel.competitors?.length) return null;
            return (
              <div style={{ background: "rgba(248,113,113,0.04)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid rgba(248,113,113,0.15)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--error)", textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)", marginBottom: 12 }}>⚔️ Competitor Intel</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {intel.competitors.map((c: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--bg-elevated)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(248,113,113,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--error)", flexShrink: 0 }}>
                        {c.name?.charAt(0) || "?"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{c.category}</div>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--warning)", maxWidth: 140, textAlign: "right" }}>{c.weakness}</div>
                    </div>
                  ))}
                </div>
                {intel.painPoints?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Pain Points Not Addressed</div>
                    {intel.painPoints.map((p: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2, paddingLeft: 4 }}>▸ {p}</div>
                    ))}
                  </div>
                )}
                {intel.positioningLine && (
                  <div style={{ fontSize: 11, color: "var(--ai)", fontWeight: 500, borderTop: "1px solid rgba(248,113,113,0.1)", paddingTop: 8, fontStyle: "italic" }}>
                    💬 "{intel.positioningLine}"
                  </div>
                )}
              </div>
            );
          })()}

          {/* Expansion Signals Feed (for Closed Won accounts) */}
          {(() => {
            const expansion = expansionSignals[account.name];
            if (!expansion || !expansion.signals?.length) return null;
            const readinessColor = expansion.readinessScore >= 70 ? "var(--success)" : expansion.readinessScore >= 40 ? "var(--warning)" : "var(--text-tertiary)";
            return (
              <div style={{ background: "rgba(52,211,153,0.04)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid rgba(52,211,153,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--success)", textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)" }}>🚀 Expansion Signals</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {expansion.checkInDue && (
                      <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 9, fontWeight: 600, background: "rgba(251,191,36,0.12)", color: "var(--warning)", border: "1px solid rgba(251,191,36,0.25)" }}>CHECK-IN DUE</span>
                    )}
                    <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", background: readinessColor + "15", color: readinessColor, border: `1px solid ${readinessColor}30` }}>
                      Readiness: {expansion.readinessScore}/100
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {expansion.signals.map((s: any, i: number) => {
                    const sColor = s.strength === "strong" ? "var(--success)" : s.strength === "medium" ? "var(--warning)" : "var(--text-tertiary)";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "var(--bg-elevated)" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: sColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, flex: 1 }}>{s.signal}</span>
                        <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: sColor, textTransform: "uppercase" }}>{s.strength}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {tab === "contacts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Add contact button */}
          <div style={{ marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddContact(!showAddContact)}>
              {showAddContact ? "Cancel" : "+ Add Contact to Account"}
            </button>
          </div>

          {/* Add contact panel */}
          {showAddContact && (
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--r-md)", padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button className={`btn btn-sm ${addMode === "link" ? "btn-primary" : "btn-ghost"}`} onClick={() => setAddMode("link")}>Link Existing</button>
                <button className={`btn btn-sm ${addMode === "new" ? "btn-primary" : "btn-ghost"}`} onClick={() => setAddMode("new")}>Create New</button>
              </div>

              {addMode === "link" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <select className="input" value={linkContactId} onChange={e => setLinkContactId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select a contact...</option>
                    {unlinkedContacts.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-sm" disabled={!linkContactId || linkMutation.isPending}
                    onClick={() => linkContactId && linkMutation.mutate(linkContactId)}>
                    {linkMutation.isPending ? "Linking..." : "Link"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input className="input" placeholder="First name" value={newContactForm.first_name} onChange={e => setNewContactForm({ ...newContactForm, first_name: e.target.value })} />
                    <input className="input" placeholder="Last name" value={newContactForm.last_name} onChange={e => setNewContactForm({ ...newContactForm, last_name: e.target.value })} />
                  </div>
                  <input className="input" placeholder="Email" type="email" value={newContactForm.email} onChange={e => setNewContactForm({ ...newContactForm, email: e.target.value })} />
                  <input className="input" placeholder="Phone" value={newContactForm.phone} onChange={e => setNewContactForm({ ...newContactForm, phone: e.target.value })} />
                  <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input type="checkbox" checked={newContactForm.consent_email} onChange={e => setNewContactForm({ ...newContactForm, consent_email: e.target.checked })} style={{ accentColor: "var(--accent)" }} /> Email consent
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input type="checkbox" checked={newContactForm.consent_sms} onChange={e => setNewContactForm({ ...newContactForm, consent_sms: e.target.checked })} style={{ accentColor: "var(--accent)" }} /> SMS consent
                    </label>
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={!newContactForm.first_name || !newContactForm.email || createAndLinkMutation.isPending}
                    onClick={() => createAndLinkMutation.mutate(newContactForm)}>
                    {createAndLinkMutation.isPending ? "Creating..." : "Create & Link"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Contact list */}
          {acctContacts.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: 10 }}>No contacts linked to this account. Click "Add Contact" above.</div>
          ) : acctContacts.map((c: any, i: number) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < acctContacts.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>
                {c.first_name[0]}{c.last_name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.first_name} {c.last_name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.email}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {c.consent_email && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(52,211,153,0.1)", color: "var(--success)" }}>Email ✓</span>}
                {c.consent_sms && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(52,211,153,0.1)", color: "var(--success)" }}>SMS ✓</span>}
              </div>
              {c.phone && <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{c.phone}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "deals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {acctDeals.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: 10 }}>No deals linked to this account.</div>
          ) : acctDeals.map((d: any, i: number) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < acctDeals.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <Briefcase style={{ width: 16, height: 16, color: "var(--accent)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{d.stage?.name || "Unknown"}</div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>{formatCurrency(d.amount || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "documents" && (
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
          Document management coming soon.
        </div>
      )}
    </div>
  );
}
