import { create } from "zustand";
type Theme = "dark" | "light";
type Role = "admin" | "manager" | "rep";

export interface OpportunityAlert {
  id: string;
  accountName: string;
  alertMessage: string;
  opportunityScore: number;
  recommendedTiming: string;
  outreachAngle: string;
  signalsFound: { signal: string; strength: string }[];
  talkingPoints: string[];
  riskFactors: string[];
  summary: string;
  timestamp: string;
  dismissed: boolean;
}

export interface ProposalDocument {
  id: string;
  dealName: string;
  title: string;
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  pricingTable: { item: string; qty: number; unitPrice: number; total: number }[];
  totalAcv: number;
  paymentTerms: string;
  validUntil: string;
  implementationTimeline: { phase: string; duration: string; milestones: string[] }[];
  whyUs: string[];
  nextSteps: string;
  summary: string;
  model: string;
  cost: number;
  timestamp: string;
}

export interface Meeting {
  id: string;
  title: string;
  type: "video" | "call" | "in_person" | "demo";
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  contactName?: string;
  dealName?: string;
  location?: string;
  notes?: string;
  aiScheduled?: boolean;
  color?: string;
}

export interface Notification {
  id: string;
  type: "ai_draft" | "deal_stage" | "task_overdue" | "agent_complete";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface SimulatedRunStep {
  label: string;
  toolCalls?: string[];
  timeMs?: number;
  tokens?: number;
}

export interface SimulatedRun {
  id: string;
  agentName: string;
  goal: string;
  status: "running" | "complete" | "cancelled" | "failed";
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  steps: SimulatedRunStep[];
  cost: number;
  startedAt: string;
  completedAt?: string;
  producesDraft: boolean;
  contactOrAccount?: string;
}

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  navPosition: "top" | "left";
  toggleNavPosition: () => void;

  theme: Theme;
  toggleTheme: () => void;

  devUser: string;
  setDevUser: (user: string) => void;

  role: Role;
  setRole: (role: Role) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  approvalsList: any[];
  setApprovalsList: (list: any[]) => void;
  addApproval: (a: any) => void;
  pendingApprovalsCount: () => number;

  // Notifications
  notifications: Notification[];
  addNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAllRead: () => void;
  unreadCount: () => number;

  // Agent runs
  agentRuns: SimulatedRun[];
  addAgentRun: (run: SimulatedRun) => void;
  updateAgentRun: (id: string, updates: Partial<SimulatedRun>) => void;
  removeAgentRun: (id: string) => void;

  // Global search
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;

  // AI running indicator
  isAnyAgentRunning: () => boolean;

  // AI state
  aiSpendToday: number;
  addAiSpend: (cost: number) => void;
  researchResults: Record<string, any>;
  setResearchResult: (name: string, result: any) => void;
  contactScores: Record<string, any>;
  setContactScore: (name: string, score: any) => void;
  dealInsights: Record<string, any>;
  setDealInsight: (name: string, insight: any) => void;
  opportunityAlerts: OpportunityAlert[];
  addOpportunityAlert: (alert: Omit<OpportunityAlert, "id" | "timestamp" | "dismissed">) => void;
  dismissOpportunityAlert: (id: string) => void;
  proposalDocuments: Record<string, ProposalDocument>;
  setProposalDocument: (dealName: string, doc: ProposalDocument) => void;

  // Meetings
  meetings: Meeting[];
  addMeeting: (m: Omit<Meeting, "id">) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  removeMeeting: (id: string) => void;
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("acufy_theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getInitialNavPosition(): "top" | "left" {
  const saved = localStorage.getItem("acufy_nav_position");
  if (saved === "top" || saved === "left") return saved;
  return "top";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("acufy_theme", theme);
}

function getRoleFromUser(user: string): Role {
  if (user === "admin") return "admin";
  if (user === "manager") return "manager";
  return "rep";
}

// Apply theme immediately
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

const initialUser = localStorage.getItem("acufy_dev_user") || "admin";
const initialNavPosition = getInitialNavPosition();

export const useAppStore = create<AppState>((set, get) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  navPosition: initialNavPosition,
  toggleNavPosition: () =>
    set((s) => {
      const next = s.navPosition === "top" ? "left" : "top";
      localStorage.setItem("acufy_nav_position", next);
      return { navPosition: next };
    }),

  theme: initialTheme,
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      return { theme: next };
    }),

  devUser: initialUser,
  setDevUser: (user: string) => {
    localStorage.setItem("acufy_dev_user", user);
    set({ devUser: user, role: getRoleFromUser(user) });
  },

  role: getRoleFromUser(initialUser),
  setRole: (role: Role) => set({ role }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),

  approvalsList: [],
  setApprovalsList: (list: any[]) => set({ approvalsList: list }),
  addApproval: (a: any) => set(s => ({ approvalsList: [a, ...s.approvalsList] })),
  pendingApprovalsCount: () => get().approvalsList.filter(a => !a.dismissed).length,

  // Notifications
  notifications: [
    {
      id: "n1", type: "ai_draft", title: "NurturerAgent drafted email",
      description: "Follow-up email for Robert Kim at Meridian Healthcare",
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(), read: false, link: "/approvals",
    },
    {
      id: "n2", type: "deal_stage", title: "Deal stage changed",
      description: "NovaStar Starter moved to Closed Won",
      timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), read: false, link: "/deals",
    },
    {
      id: "n3", type: "agent_complete", title: "ResearchAgent completed",
      description: "GreenLeaf Manufacturing profile enriched with 12 new signals",
      timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), read: true, link: "/accounts",
    },
  ],
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: `n-${Date.now()}`, timestamp: new Date().toISOString(), read: false },
        ...s.notifications,
      ],
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
  unreadCount: () => get().notifications.filter((n) => !n.read).length,

  // Agent runs
  agentRuns: [],
  addAgentRun: (run) => set((s) => ({ agentRuns: [run, ...s.agentRuns] })),
  updateAgentRun: (id, updates) =>
    set((s) => ({
      agentRuns: s.agentRuns.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),
  removeAgentRun: (id) =>
    set((s) => ({ agentRuns: s.agentRuns.filter((r) => r.id !== id) })),

  // Global search
  globalSearchOpen: false,
  setGlobalSearchOpen: (open: boolean) => set({ globalSearchOpen: open }),

  // AI running indicator
  isAnyAgentRunning: () => get().agentRuns.some((r) => r.status === "running"),

  // AI state
  aiSpendToday: 0,
  addAiSpend: (cost: number) => set((s) => ({ aiSpendToday: s.aiSpendToday + cost })),
  researchResults: {},
  setResearchResult: (name: string, result: any) => set((s) => ({ researchResults: { ...s.researchResults, [name]: result } })),
  contactScores: {},
  setContactScore: (name: string, score: any) => set((s) => ({ contactScores: { ...s.contactScores, [name]: score } })),
  dealInsights: {},
  setDealInsight: (name: string, insight: any) => set((s) => ({ dealInsights: { ...s.dealInsights, [name]: insight } })),
  opportunityAlerts: [],
  addOpportunityAlert: (alert) =>
    set((s) => ({
      opportunityAlerts: [
        { ...alert, id: `opp-${Date.now()}`, timestamp: new Date().toISOString(), dismissed: false },
        ...s.opportunityAlerts,
      ],
    })),
  dismissOpportunityAlert: (id) =>
    set((s) => ({
      opportunityAlerts: s.opportunityAlerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    })),
  proposalDocuments: {},
  setProposalDocument: (dealName: string, doc: ProposalDocument) =>
    set((s) => ({ proposalDocuments: { ...s.proposalDocuments, [dealName]: doc } })),

  // Meetings — seed realistic data
  meetings: [
    { id: "mtg-1", title: "Discovery Call — Alex Johnson", type: "call", date: new Date().toISOString().split("T")[0], startTime: "09:00", endTime: "09:30", contactName: "Alex Johnson", dealName: "Alex Johnson Pro Plan", notes: "Discuss requirements & timeline", color: "#38bdf8" },
    { id: "mtg-2", title: "TechVista Demo", type: "demo", date: new Date().toISOString().split("T")[0], startTime: "11:00", endTime: "12:00", contactName: "Sarah Chen", dealName: "TechVista Enterprise License", location: "Zoom", notes: "Product demo for engineering team", color: "#a78bfa" },
    { id: "mtg-3", title: "Meridian Follow-up", type: "video", date: new Date().toISOString().split("T")[0], startTime: "14:00", endTime: "14:45", contactName: "Robert Kim", dealName: "Meridian CRM Migration", location: "Google Meet", notes: "Review migration timeline", color: "#34d399" },
    { id: "mtg-4", title: "Atlas Financial Proposal Review", type: "video", date: new Date(Date.now() + 86400000).toISOString().split("T")[0], startTime: "10:00", endTime: "10:30", contactName: "Michael Torres", dealName: "Atlas Financial Suite", location: "Teams", aiScheduled: true, color: "#38bdf8" },
    { id: "mtg-5", title: "GreenLeaf Negotiation", type: "in_person", date: new Date(Date.now() + 86400000).toISOString().split("T")[0], startTime: "15:00", endTime: "16:00", contactName: "James Wilson", dealName: "GreenLeaf Supply Chain", location: "GreenLeaf HQ", notes: "Contract terms discussion", color: "#fb923c" },
    { id: "mtg-6", title: "NovaStar Onboarding Kick-off", type: "video", date: new Date(Date.now() + 2*86400000).toISOString().split("T")[0], startTime: "13:00", endTime: "14:00", contactName: "Priya Patel", dealName: "NovaStar Starter", location: "Zoom", color: "#f472b6" },
    { id: "mtg-7", title: "Weekly Pipeline Review", type: "video", date: new Date(Date.now() + 3*86400000).toISOString().split("T")[0], startTime: "09:00", endTime: "09:45", location: "Google Meet", notes: "Internal team sync", color: "#94a3b8" },
    { id: "mtg-8", title: "Chris Williams Check-in", type: "call", date: new Date(Date.now() + 4*86400000).toISOString().split("T")[0], startTime: "11:00", endTime: "11:30", contactName: "Chris Williams", dealName: "Chris Williams Enterprise", aiScheduled: true, color: "#38bdf8" },
  ],
  addMeeting: (m) => set((s) => ({ meetings: [...s.meetings, { ...m, id: `mtg-${Date.now()}` }] })),
  updateMeeting: (id, updates) => set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)) })),
  removeMeeting: (id) => set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) })),
}));
