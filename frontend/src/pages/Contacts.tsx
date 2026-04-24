import React, { useRef, useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contactsApi, dealsApi, accountsApi, type Contact, type Deal, type Account } from "../lib/api";
import { formatRelativeTime, formatDate, formatCurrency } from "../lib/utils";
import { useAppStore } from "../lib/store";
import gsap from "gsap";
import { Search, Edit2, Trash2, ArrowUp, ArrowDown, Download, Sparkles, X, Upload } from "lucide-react";
import Sheet from "../components/Sheet";
import CSVImportWizard from "../components/CSVImportWizard";
import { showToast } from "../components/Toast";
import { confirmAction } from "../components/ConfirmDialog";
import { useAgentSimulation } from "../lib/useAgentSimulation";

type ConsentFilter = "all" | "sms" | "email_only" | "none";
type SortField = "name" | "email" | "created";
type SortDir = "asc" | "desc";

export default function ContactsPage() {
  const qc = useQueryClient();
  const { role, contactScores } = useAppStore();
  const { startRun } = useAgentSimulation();
  const { data: contactsRes } = useQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });
  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });
  const { data: accountsRes } = useQuery({ queryKey: ["accounts"], queryFn: () => accountsApi.list({}) });
  const contacts = contactsRes?.data?.items || [];
  const deals: Deal[] = dealsRes?.data?.items || [];
  const accounts = accountsRes?.data?.items || [];
  const listRef = useRef<HTMLTableSectionElement>(null);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Contact>>({ consent_email: true, consent_sms: true });
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [consentFilter, setConsentFilter] = useState<ConsentFilter>("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  useEffect(() => {
    if (listRef.current) gsap.fromTo(listRef.current.children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.03, ease: "power2.out" });
  }, [contacts.length, consentFilter, searchQuery]);

  const filteredContacts = useMemo(() => {
    let list = [...contacts];
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: Contact) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    }
    // Consent filter
    if (consentFilter === "sms") list = list.filter((c: Contact) => c.consent_sms);
    else if (consentFilter === "email_only") list = list.filter((c: Contact) => c.consent_email && !c.consent_sms);
    else if (consentFilter === "none") list = list.filter((c: Contact) => !c.consent_email && !c.consent_sms);
    // Sort
    if (sortField) {
      list.sort((a: Contact, b: Contact) => {
        let va: string, vb: string;
        if (sortField === "name") { va = `${a.first_name} ${a.last_name}`; vb = `${b.first_name} ${b.last_name}`; }
        else if (sortField === "email") { va = a.email; vb = b.email; }
        else { va = a.created_at; vb = b.created_at; }
        const cmp = va.localeCompare(vb);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [contacts, searchQuery, consentFilter, sortField, sortDir]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Contact>) => editingContact ? contactsApi.update(editingContact.id, data) : contactsApi.create(data),
    onSuccess: async (res, vars) => {
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      setIsSheetOpen(false);
      showToast(editingContact ? "Contact updated" : "Contact created", "success");
      if (!editingContact && res?.data) {
        // Refetch fresh contacts so the new contact is in the list
        const freshContacts = await qc.fetchQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });
        const freshList = [...(freshContacts?.data?.items || [])];
        if (!freshList.find((c: any) => c.id === res.data.id)) {
            freshList.push({ ...res.data, consent_email: res.data.consent_email ?? true, consent_sms: res.data.consent_sms ?? true });
        }
        const contactFullName = `${res.data.first_name || ""} ${res.data.last_name || ""}`.trim();
        // Chain: LeadQualifier → (auto-chains Research → Nurturer for hot leads)
        try {
          startRun("lead_qualification", `Score & qualify ${contactFullName}`, contactFullName, { contacts: freshList, accounts, deals });
        } catch (err) {
          console.error("[Contacts] Lead qualification trigger failed:", err);
        }
      }
      setEditingContact(null);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); showToast("Contact deleted", "success"); }
  });

  const openEdit = (c: Contact) => { setEditingContact(c); setIsSheetOpen(true); };
  const openCreate = () => { setEditingContact(null); setIsSheetOpen(true); };
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };
  const toggleSelect = (id: string) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredContacts.map((c: Contact) => c.id)));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const accountId = fd.get("account_id") as string;
    saveMutation.mutate({
      first_name: fd.get("first_name") as string,
      last_name: fd.get("last_name") as string,
      email: fd.get("email") as string,
      phone: fd.get("phone") as string,
      account_id: accountId || null,
      consent_email: fd.get("consent_email") === "on",
      consent_sms: fd.get("consent_sms") === "on"
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirmAction({
      title: "Delete Contact",
      message: `Are you sure you want to delete "${name}"? All associated data will be lost.`,
      confirmText: "Delete Contact",
      variant: "danger",
    });
    if (confirmed) deleteMutation.mutate(id);
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirmAction({
      title: "Delete Contacts",
      message: `Are you sure you want to delete ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`,
      confirmText: `Delete ${selectedIds.size} Contact${selectedIds.size > 1 ? "s" : ""}`,
      variant: "danger",
    });
    if (confirmed) {
      selectedIds.forEach(id => deleteMutation.mutate(id));
      setSelectedIds(new Set());
    }
  };

  const handleExportCSV = () => {
    const selected = filteredContacts.filter((c: Contact) => selectedIds.has(c.id));
    const csv = "Name,Email,Phone,Email Consent,SMS Consent\n" +
      selected.map((c: Contact) => `"${c.first_name} ${c.last_name}","${c.email}","${c.phone || ""}",${c.consent_email},${c.consent_sms}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "contacts_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ArrowUp style={{ width: 10, height: 10, display: "inline" }} /> : <ArrowDown style={{ width: 10, height: 10, display: "inline" }} />;
  };

  return (
    <div className="page-wrapper anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">{contacts.length} total contacts</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setIsImportWizardOpen(true)}>
            <Upload style={{ width: 14, height: 14 }} /> Import CSV
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Contact</button>
        </div>
      </div>

      <div className="table-wrap">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--text-tertiary)" }} />
            <input type="text" placeholder="Search contacts..." className="input" style={{ paddingLeft: 32 }}
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="filter-chips">
            {([["all", "All"], ["sms", "SMS Consent"], ["email_only", "Email Only"], ["none", "No Consent"]] as [ConsentFilter, string][]).map(([key, label]) => (
              <button key={key} className={`chip ${consentFilter === key ? "active" : ""}`} onClick={() => setConsentFilter(key)}>{label}</button>
            ))}
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                  onChange={toggleSelectAll} style={{ accentColor: "var(--accent)" }} />
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("name")}>Contact <SortIcon field="name" /></th>
              <th>Status</th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("email")}>Email <SortIcon field="email" /></th>
              <th>Phone</th>
              <th>Consent</th>
              <th>AI Score</th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("created")}>Created <SortIcon field="created" /></th>
              <th></th>
            </tr>
          </thead>
          <tbody ref={listRef}>
            {filteredContacts.map((contact: Contact, i: number) => (
              <tr key={contact.id} className="group" onClick={() => setDetailContact(contact)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelect(contact.id)} style={{ accentColor: "var(--accent)" }} />
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className={`avatar av-${i % 8}`} style={{ width: 32, height: 32, fontSize: 11 }}>
                      {contact.first_name[0]}{contact.last_name[0]}
                    </div>
                    <span style={{ fontWeight: 500 }}>{contact.first_name} {contact.last_name}</span>
                  </div>
                </td>
                <td>
                  {(() => {
                    const fullName = `${contact.first_name} ${contact.last_name}`;
                    const score = contactScores[fullName];
                    const linkedDeals = deals.filter((d: Deal) => d.contact_id === contact.id);
                    const hasWon = linkedDeals.some((d: Deal) => d.stage?.name === "Closed Won");
                    const hasActiveDeals = linkedDeals.length > 0;
                    let status = "Lead";
                    let statusColor = "var(--text-tertiary)";
                    let statusBg = "rgba(148,163,184,0.1)";
                    if (hasWon) { status = "Customer"; statusColor = "var(--success)"; statusBg = "rgba(52,211,153,0.1)"; }
                    else if (hasActiveDeals) { status = "Prospect"; statusColor = "var(--accent)"; statusBg = "rgba(56,189,248,0.1)"; }
                    else if (score?.qualification === "hot") { status = "Qualified"; statusColor = "var(--warning)"; statusBg = "rgba(251,191,36,0.1)"; }
                    else if (score?.qualification === "warm") { status = "Nurturing"; statusColor = "var(--ai)"; statusBg = "rgba(167,139,250,0.1)"; }
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", background: statusBg, color: statusColor, border: `1px solid ${statusColor}25`, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                        {status}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ color: "var(--text-secondary)" }}>{contact.email}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)" }}>{contact.phone || "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    {contact.consent_email && <span className="pill pill-success">Email ✓</span>}
                    {contact.consent_sms && <span className="pill pill-success">SMS ✓</span>}
                    {!contact.consent_email && !contact.consent_sms && <span className="pill pill-neutral">None</span>}
                  </div>
                </td>
                <td>
                  {(() => {
                    const fullName = `${contact.first_name} ${contact.last_name}`;
                    const score = contactScores[fullName];
                    if (!score) return <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>;
                    const color = score.qualification === "hot" ? "var(--error)" : score.qualification === "warm" ? "var(--warning)" : "var(--text-tertiary)";
                    const bg = score.qualification === "hot" ? "rgba(248,113,113,0.1)" : score.qualification === "warm" ? "rgba(251,191,36,0.1)" : "rgba(148,163,184,0.1)";
                    return (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        background: bg, color,
                        border: `1px solid ${color}30`,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                        {score.overallScore}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)" }}>{formatRelativeTime(contact.created_at)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }} className="group-hover:opacity-100">
                    <button className="btn btn-ghost btn-sm" title="Run AI" onClick={() => { startRun("lead_qualification", `Qualify ${contact.first_name} ${contact.last_name}`, `${contact.first_name} ${contact.last_name}`, { contacts, accounts, deals }); showToast(`✦ AI qualification started for ${contact.first_name}`, "ai"); }}><Sparkles style={{width: 14, height: 14, color: "var(--ai)"}} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(contact)}><Edit2 style={{width: 14, height: 14}} /></button>
                    <button className="btn btn-danger-ghost btn-sm" onClick={() => handleDelete(contact.id, `${contact.first_name} ${contact.last_name}`)}><Trash2 style={{width: 14, height: 14}} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredContacts.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No contacts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="anim-fade-up" style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "var(--bg-card)", border: "1px solid var(--border-accent)", borderRadius: "var(--r-lg)",
          padding: "10px 20px", display: "flex", alignItems: "center", gap: 16, zIndex: 50,
          boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 20px var(--accent-glow)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>{selectedIds.size} selected</span>
          <button className="btn btn-ghost btn-sm" onClick={handleExportCSV}><Download style={{ width: 12, height: 12 }} /> Export CSV</button>
          {role !== "rep" && (
            <button className="btn btn-ai btn-sm"><Sparkles style={{ width: 12, height: 12 }} /> Run AI</button>
          )}
          <button className="btn btn-danger-ghost btn-sm" onClick={handleBulkDelete}><Trash2 style={{ width: 12, height: 12 }} /> Delete</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}><X style={{ width: 12, height: 12 }} /></button>
        </div>
      )}

      {/* CREATE/EDIT SHEET */}
      <Sheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editingContact ? "Edit Contact" : "New Contact"}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label className="label">First Name</label><input name="first_name" defaultValue={editingContact?.first_name} required className="input" /></div>
            <div><label className="label">Last Name</label><input name="last_name" defaultValue={editingContact?.last_name} required className="input" /></div>
          </div>
          <div><label className="label">Email Address</label><input name="email" type="email" defaultValue={editingContact?.email} required className="input" /></div>
          <div><label className="label">Phone Number</label><input name="phone" defaultValue={editingContact?.phone || ""} className="input" /></div>
          <div>
            <label className="label">Account</label>
            <select name="account_id" defaultValue={editingContact?.account_id || ""} className="input">
              <option value="">No account</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div style={{ background: "var(--bg-elevated)", padding: 16, borderRadius: "var(--r-md)", border: "1px solid var(--border-default)", marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Consent & Compliance</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" name="consent_email" defaultChecked={editingContact ? editingContact.consent_email : true} style={{ accentColor: "var(--accent)" }} />
              Marketing Email Consent
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" name="consent_sms" defaultChecked={editingContact?.consent_sms} style={{ accentColor: "var(--accent)" }} />
              SMS/Text Message Consent
            </label>
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsSheetOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Contact"}</button>
          </div>
        </form>
      </Sheet>

      {/* DETAIL SHEET */}
      <Sheet isOpen={!!detailContact} onClose={() => setDetailContact(null)} title={detailContact ? `${detailContact.first_name} ${detailContact.last_name}` : ""}>
        {detailContact && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="avatar av-1" style={{ width: 48, height: 48, borderRadius: 12, fontSize: 16 }}>
                {detailContact.first_name[0]}{detailContact.last_name[0]}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}>{detailContact.first_name} {detailContact.last_name}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{detailContact.email}</div>
                {detailContact.phone && <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{detailContact.phone}</div>}
              </div>
            </div>

            {/* AI Lead Score */}
            {(() => {
              const fullName = `${detailContact.first_name} ${detailContact.last_name}`;
              const score = contactScores[fullName];
              if (!score) return null;
              const qualColor = score.qualification === "hot" ? "var(--error)" : score.qualification === "warm" ? "var(--warning)" : "var(--text-tertiary)";
              const qualBg = score.qualification === "hot" ? "rgba(248,113,113,0.08)" : score.qualification === "warm" ? "rgba(251,191,36,0.08)" : "rgba(148,163,184,0.08)";
              return (
                <div style={{ background: qualBg, borderRadius: "var(--r-md)", padding: 16, border: `1px solid ${qualColor}30` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: qualColor, textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-display)" }}>🎯 AI Lead Score</div>
                    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", background: qualColor, color: "#fff" }}>
                      {score.overallScore}/100 · {score.qualification.toUpperCase()}
                    </span>
                  </div>
                  {score.bantScore && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {Object.entries(score.bantScore).map(([key, val]: [string, any]) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, width: 70, color: "var(--text-secondary)", textTransform: "capitalize" }}>{key}</span>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
                            <div style={{ width: `${(val.score / 10) * 100}%`, height: "100%", borderRadius: 3, background: qualColor, transition: "width 0.5s" }} />
                          </div>
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", width: 24, textAlign: "right" }}>{val.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {score.keyInsights && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {score.keyInsights.map((insight: string, i: number) => (
                        <div key={i} style={{ marginBottom: 2 }}>• {insight}</div>
                      ))}
                    </div>
                  )}
                  {score.recommendedNextAction && (
                    <div style={{ fontSize: 11, color: qualColor, fontWeight: 600, borderTop: `1px solid ${qualColor}20`, paddingTop: 8, marginTop: 4 }}>
                      ➜ {score.recommendedNextAction}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Consent toggles */}
            <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: "var(--font-display)" }}>Consent Status</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <span style={{ fontSize: 13 }}>✉ Email Marketing</span>
                  <div onClick={(e) => { e.preventDefault(); const newVal = !detailContact.consent_email; contactsApi.update(detailContact.id, { consent_email: newVal }).then(() => { qc.invalidateQueries({ queryKey: ["contacts"] }); setDetailContact({...detailContact, consent_email: newVal}); showToast(`Email consent ${newVal ? "granted" : "revoked"} for ${detailContact.first_name}`, newVal ? "success" : "warning"); }); }}
                    style={{ width: 40, height: 22, borderRadius: 11, background: detailContact.consent_email ? "var(--success)" : "var(--bg-card)", border: "1px solid var(--border-default)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: detailContact.consent_email ? 21 : 2, transition: "left 0.2s" }} />
                  </div>
                </label>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <span style={{ fontSize: 13 }}>💬 SMS/Text</span>
                  <div onClick={(e) => { e.preventDefault(); const newVal = !detailContact.consent_sms; contactsApi.update(detailContact.id, { consent_sms: newVal }).then(() => { qc.invalidateQueries({ queryKey: ["contacts"] }); setDetailContact({...detailContact, consent_sms: newVal}); showToast(`SMS consent ${newVal ? "granted" : "revoked"} for ${detailContact.first_name}`, newVal ? "success" : "warning"); }); }}
                    style={{ width: 40, height: 22, borderRadius: 11, background: detailContact.consent_sms ? "var(--success)" : "var(--bg-card)", border: "1px solid var(--border-default)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: detailContact.consent_sms ? 21 : 2, transition: "left 0.2s" }} />
                  </div>
                </label>
              </div>
            </div>

            {/* Linked Deals */}
            {(() => {
              const linkedDeals = deals.filter((d: Deal) => d.contact_id === detailContact.id);
              return linkedDeals.length > 0 ? (
                <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--border-default)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: "var(--font-display)" }}>Linked Deals</div>
                  {linkedDeals.map((d: Deal) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{d.name}</span>
                      <span className="pill pill-neutral">{d.stage?.name}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>{formatCurrency(d.amount || 0)}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Meta */}
            <div style={{ display: "flex", gap: 20 }}>
              <div><div className="label">Created</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{formatDate(detailContact.created_at)}</div></div>
              <div><div className="label">Updated</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{formatDate(detailContact.updated_at)}</div></div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => { setDetailContact(null); openEdit(detailContact); }}>Edit Contact</button>
              <button className="btn btn-ai" onClick={() => {
                const fullName = `${detailContact.first_name || ""} ${detailContact.last_name || ""}`.trim();
                const cachedDeals = qc.getQueryData<{ data: { items: Deal[] } }>(["deals"])?.data.items || [];
                const contactsList = qc.getQueryData<{ data: { items: Contact[] } }>(["contacts"])?.data.items || [];
                const cachedAccounts = qc.getQueryData<{ data: { items: Account[] } }>(["accounts"])?.data.items || [];
                startRun("lead_qualification", `Qualify ${fullName}`, fullName, { deals: cachedDeals, contacts: contactsList, accounts: cachedAccounts });
                showToast(`✦ AI qualification started for ${detailContact.first_name}`, "ai");
              }}>✦ Run AI</button>
            </div>
          </div>
        )}
      </Sheet>

      <CSVImportWizard 
        isOpen={isImportWizardOpen} 
        onClose={() => setIsImportWizardOpen(false)} 
        onImportComplete={(count) => {
          qc.invalidateQueries({ queryKey: ["contacts"] });
          showToast(`\u2713 ${count} contacts imported successfully`, "success");
        }} 
      />
    </div>
  );
}
