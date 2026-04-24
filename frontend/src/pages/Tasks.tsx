import React, { useRef, useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi, dealsApi, contactsApi, type Task, type Deal, type Contact } from "../lib/api";
import { formatRelativeTime, formatDate } from "../lib/utils";
import gsap from "gsap";
import { CheckCircle, Circle, Calendar, Sparkles, Trash2, Edit2, AlertCircle, Clock, Mail, User, Briefcase, Tag, Flag } from "lucide-react";
import Sheet from "../components/Sheet";
import { showToast } from "../components/Toast";
import { confirmAction } from "../components/ConfirmDialog";

type TaskFilter = "all" | "today" | "this_week" | "overdue";
type TaskPriority = "low" | "medium" | "high" | "urgent";

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string; icon: string }> = {
  low: { label: "Low", color: "var(--text-tertiary)", bg: "transparent", border: "var(--border-default)", icon: "○" },
  medium: { label: "Medium", color: "var(--accent)", bg: "rgba(56,189,248,0.06)", border: "rgba(56,189,248,0.2)", icon: "◐" },
  high: { label: "High", color: "var(--warning)", bg: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.2)", icon: "●" },
  urgent: { label: "Urgent", color: "var(--error)", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.2)", icon: "🔴" },
};

const TASK_TYPES = [
  { value: "general", label: "General", icon: "📋" },
  { value: "email_draft", label: "Schedule Email Draft", icon: "✉️" },
  { value: "follow_up", label: "Follow Up", icon: "🔄" },
  { value: "call", label: "Phone Call", icon: "📞" },
  { value: "meeting", label: "Meeting", icon: "🤝" },
  { value: "review", label: "Review / Approval", icon: "👁️" },
];

export default function TasksPage() {
  const qc = useQueryClient();
  const { data: tasksRes } = useQuery({ queryKey: ["tasks"], queryFn: () => tasksApi.list({}) });
  const { data: dealsRes } = useQuery({ queryKey: ["deals"], queryFn: () => dealsApi.list({}) });
  const { data: contactsRes } = useQuery({ queryKey: ["contacts"], queryFn: () => contactsApi.list({}) });

  const tasks = tasksRes?.data?.items || [];
  const deals = dealsRes?.data?.items || [];
  const contacts = contactsRes?.data?.items || [];
  const listRef = useRef<HTMLDivElement>(null);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [taskType, setTaskType] = useState("general");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  useEffect(() => {
    if (listRef.current) gsap.fromTo(listRef.current.children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.03, ease: "power2.out" });
  }, [tasks.length, filter]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Task>) => editingTask ? tasksApi.update(editingTask.id, data) : tasksApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setIsSheetOpen(false); showToast(editingTask ? "Task updated" : "Task created", "success"); setEditingTask(null); setTaskType("general"); setPriority("medium"); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); showToast("Task deleted", "success"); },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => tasksApi.update(id, { status }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["tasks"] }); showToast(vars.status === "done" ? "Task completed ✓" : "Task reopened", "success"); },
  });

  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const weekEnd = new Date(todayEnd.getTime() + 7 * 86400000);

  const isOverdue = (t: Task) => t.due_at && new Date(t.due_at) < now && t.status !== "done";
  const isToday = (t: Task) => t.due_at && new Date(t.due_at) <= todayEnd && new Date(t.due_at) >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isThisWeek = (t: Task) => t.due_at && new Date(t.due_at) <= weekEnd;

  const overdueCount = tasks.filter((t: Task) => isOverdue(t)).length;
  const completedCount = tasks.filter((t: Task) => t.status === "done").length;
  const pendingCount = tasks.length - completedCount;

  const filteredTasks = useMemo(() => {
    let list = [...tasks];
    if (filter === "today") list = list.filter((t: Task) => isToday(t) || isOverdue(t));
    else if (filter === "this_week") list = list.filter((t: Task) => isThisWeek(t));
    else if (filter === "overdue") list = list.filter((t: Task) => isOverdue(t));
    return list.sort((a: Task, b: Task) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return 0;
    });
  }, [tasks, filter]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dt = fd.get("due_at") as string;
    saveMutation.mutate({
      title: fd.get("title") as string,
      description: fd.get("description") as string || undefined,
      due_at: dt ? new Date(dt).toISOString() : undefined,
      deal_id: (fd.get("deal_id") as string) || undefined,
      contact_id: (fd.get("contact_id") as string) || undefined,
      status: editingTask?.status || "pending",
      custom_fields: {
        task_type: taskType,
        priority: priority,
        email_subject: (fd.get("email_subject") as string) || undefined,
        email_notes: (fd.get("email_notes") as string) || undefined,
      },
    });
  };

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await confirmAction({
      title: "Delete Task",
      message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      confirmText: "Delete Task",
      variant: "danger",
    });
    if (confirmed) deleteMutation.mutate(id);
  };

  const getDealName = (id: string | null) => { if (!id) return null; const d = deals.find((d: Deal) => d.id === id); return d ? d.name : null; };
  const getContactName = (id: string | null) => { if (!id) return null; const c = contacts.find((c: Contact) => c.id === id); return c ? `${c.first_name} ${c.last_name}` : null; };

  return (
    <div className="page-wrapper anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">
            {pendingCount} pending · {completedCount} completed
            {overdueCount > 0 && <> · <span style={{ color: "var(--error)" }}>{overdueCount} overdue</span></>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingTask(null); setTaskType("general"); setPriority("medium"); setIsSheetOpen(true); }}>+ New Task</button>
      </div>

      {/* Filter chips */}
      <div className="filter-chips" style={{ marginBottom: 16 }}>
        {([["all", "All"], ["today", "Today"], ["this_week", "This Week"], ["overdue", "Overdue"]] as [TaskFilter, string][]).map(([key, label]) => (
          <button key={key} className={`chip ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>
            {label}
            {key === "overdue" && overdueCount > 0 && (
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--error)", display: "inline-block", marginLeft: 4 }} />
            )}
          </button>
        ))}
      </div>

      <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filteredTasks.map((task: Task) => {
          const isDone = task.status === "done";
          const overdue = isOverdue(task);
          const dealName = getDealName(task.deal_id);
          const contactName = getContactName(task.contact_id);
          const cf = (task.custom_fields || {}) as any;
          const tp = cf.task_type || "general";
          const pr = cf.priority as TaskPriority || "medium";
          const pConfig = PRIORITY_CONFIG[pr] || PRIORITY_CONFIG.medium;
          const typeInfo = TASK_TYPES.find(t => t.value === tp);

          return (
            <div key={task.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
              background: "var(--bg-card)", border: `1px solid ${overdue ? "rgba(248,113,113,0.2)" : "var(--border-default)"}`, borderRadius: "var(--r-md)",
              opacity: isDone ? 0.55 : 1, transition: "all 0.3s",
              borderLeft: overdue ? "3px solid var(--error)" : isDone ? "3px solid var(--success)" : `3px solid ${pConfig.color}`,
            }} className="group">
              {/* Checkbox */}
              <button onClick={() => toggleMutation.mutate({ id: task.id, status: isDone ? "pending" : "done" })}
                style={{ background: "none", border: "none", cursor: "pointer", color: isDone ? "var(--success)" : "var(--text-tertiary)", flexShrink: 0, transition: "color 0.15s" }}
                onMouseEnter={(e) => { if (!isDone) e.currentTarget.style.color = "var(--success)"; }}
                onMouseLeave={(e) => { if (!isDone) e.currentTarget.style.color = "var(--text-tertiary)"; }}
              >
                {isDone ? <CheckCircle style={{ width: 20, height: 20 }} /> : <Circle style={{ width: 20, height: 20 }} />}
              </button>

              {/* Type icon */}
              {typeInfo && (
                <span style={{ fontSize: 16, flexShrink: 0, opacity: isDone ? 0.5 : 0.8 }}>{typeInfo.icon}</span>
              )}

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, textDecoration: isDone ? "line-through" : "none", marginBottom: 3, color: "var(--text-primary)" }}>{task.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {task.description && <span style={{ fontSize: 12, color: "var(--text-tertiary)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.description}</span>}
                  {dealName && (
                    <span style={{ fontSize: 11, color: "var(--ai)", display: "flex", alignItems: "center", gap: 3 }}>
                      <Briefcase style={{ width: 10, height: 10 }} /> {dealName}
                    </span>
                  )}
                  {contactName && (
                    <span style={{ fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 3 }}>
                      <User style={{ width: 10, height: 10 }} /> {contactName}
                    </span>
                  )}
                </div>
              </div>

              {/* Priority badge */}
              <span style={{
                fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
                padding: "2px 8px", borderRadius: 20,
                background: pConfig.bg, color: pConfig.color, border: `1px solid ${pConfig.border}`,
                flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5,
              }}>
                {pConfig.label}
              </span>

              {/* Due date */}
              {task.due_at && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)", color: overdue ? "var(--error)" : "var(--text-tertiary)", flexShrink: 0 }}>
                  {overdue && <AlertCircle style={{ width: 11, height: 11 }} />}
                  <Calendar style={{ width: 11, height: 11 }} />
                  {formatDate(task.due_at)}
                </div>
              )}

              {/* AI badge */}
              {task.ai_proposed && <span className="pill pill-ai" style={{ flexShrink: 0 }}>✦ AI</span>}

              {/* Actions */}
              <div style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s", flexShrink: 0 }} className="group-hover:opacity-100">
                <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => {
                  setEditingTask(task);
                  setTaskType(cf.task_type || "general");
                  setPriority(cf.priority || "medium");
                  setIsSheetOpen(true);
                }}><Edit2 style={{ width: 12, height: 12 }} /></button>
                <button className="btn btn-danger-ghost btn-sm" style={{ padding: 4 }} onClick={() => handleDelete(task.id, task.title)}>
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>All clear</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No tasks match this filter.</div>
          </div>
        )}
      </div>

      {/* CREATE/EDIT SHEET */}
      <Sheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editingTask ? "Edit Task" : "New Task"}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Task Type selector */}
          <div>
            <label className="label" style={{ marginBottom: 8 }}>Task Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {TASK_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setTaskType(t.value)}
                  style={{
                    padding: "10px 8px", borderRadius: "var(--r-md)", cursor: "pointer",
                    background: taskType === t.value ? "var(--accent-glow)" : "var(--bg-elevated)",
                    border: `1px solid ${taskType === t.value ? "var(--border-accent)" : "var(--border-default)"}`,
                    color: taskType === t.value ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: 11, fontWeight: 500, textAlign: "center", transition: "all 0.15s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}>
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Title *</label>
            <input name="title" defaultValue={editingTask?.title} required className="input" placeholder="What needs to be done?" />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea name="description" defaultValue={editingTask?.description || ""} className="input" rows={3} style={{ resize: "vertical" }} placeholder="Add details, context, or notes..." />
          </div>

          {/* Priority selector */}
          <div>
            <label className="label" style={{ marginBottom: 8 }}>Priority</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG.low][]).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setPriority(key)}
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: "var(--r-md)", cursor: "pointer",
                    background: priority === key ? cfg.bg : "var(--bg-elevated)",
                    border: `1px solid ${priority === key ? cfg.border : "var(--border-default)"}`,
                    color: priority === key ? cfg.color : "var(--text-tertiary)",
                    fontSize: 11, fontWeight: 600, textAlign: "center", transition: "all 0.15s",
                    textTransform: "uppercase", letterSpacing: 0.5,
                  }}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="label"><Clock style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />Due Date & Time</label>
            <input name="due_at" type="datetime-local" defaultValue={editingTask?.due_at ? new Date(editingTask.due_at).toISOString().slice(0, 16) : ""} className="input" />
          </div>

          {/* Email scheduling fields */}
          {taskType === "email_draft" && (
            <div style={{ background: "var(--accent-glow)", border: "1px solid var(--border-accent)", borderRadius: "var(--r-md)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Mail style={{ width: 12, height: 12 }} /> Email Draft Settings
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="label">Email Subject</label>
                  <input name="email_subject" className="input" placeholder="Subject line for the draft..." defaultValue={(editingTask?.custom_fields as any)?.email_subject || ""} />
                </div>
                <div>
                  <label className="label">Key Points / Notes for AI</label>
                  <textarea name="email_notes" className="input" rows={3} style={{ resize: "vertical" }} placeholder="Brief the AI on what to include in the draft..." defaultValue={(editingTask?.custom_fields as any)?.email_notes || ""} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Sparkles style={{ width: 11, height: 11, color: "var(--ai)" }} />
                  AI will auto-draft this email at the scheduled time
                </div>
              </div>
            </div>
          )}

          {/* Link to Deal / Contact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label"><Briefcase style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />Link to Deal</label>
              <select name="deal_id" defaultValue={editingTask?.deal_id || ""} className="input select-styled">
                <option value="">None</option>
                {deals.map((d: Deal) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label"><User style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />Link to Contact</label>
              <select name="contact_id" defaultValue={editingTask?.contact_id || ""} className="input select-styled">
                <option value="">None</option>
                {contacts.map((c: Contact) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsSheetOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
