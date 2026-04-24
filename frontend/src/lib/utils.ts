/** Utility functions — Acufy CRM */

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(amount: number | null, currency = "USD"): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateStr));
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

/** Deterministic color from a name hash — for avatar backgrounds */
export function nameToColor(name: string): string {
  const COLORS = [
    "linear-gradient(135deg, #38BDF8, #0EA5E9)",   // cyan
    "linear-gradient(135deg, #A78BFA, #7C3AED)",   // purple
    "linear-gradient(135deg, #34D399, #059669)",   // emerald
    "linear-gradient(135deg, #FBBF24, #D97706)",   // amber
    "linear-gradient(135deg, #F87171, #DC2626)",   // red
    "linear-gradient(135deg, #60A5FA, #2563EB)",   // blue
    "linear-gradient(135deg, #EC4899, #BE185D)",   // pink
    "linear-gradient(135deg, #FB923C, #EA580C)",   // orange
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

export function activityIcon(type: string): string {
  const icons: Record<string, string> = { call: "📞", email: "✉️", sms: "💬", note: "📝", meeting: "🤝", task: "✅", document_sent: "📄" };
  return icons[type] || "📋";
}

export function formatCloseDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateStr));
}

export function daysAgo(dateStr: string): number {
  const now = new Date();
  const date = new Date(dateStr);
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

