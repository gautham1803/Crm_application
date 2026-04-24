import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

let auth0Token = "";
export const setAuth0Token = (token: string) => {
  auth0Token = token;
};

// Dev auth: inject X-Dev-User header, or Bearer if auth0 is present
api.interceptors.request.use((config) => {
  if (auth0Token) {
    config.headers.Authorization = `Bearer ${auth0Token}`;
  }
  const devUser = localStorage.getItem("acufy_dev_user") || "admin";
  config.headers["X-Dev-User"] = devUser;
  return config;
});

// Response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // In production, redirect to Auth0 login
      console.warn("Unauthorized — dev mode active");
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Typed API helpers ──────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Account {
  id: string;
  team_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  annual_revenue: number | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  account_id: string | null;
  consent_sms: boolean;
  consent_email: boolean;
  consent_source: string | null;
  consent_timestamp: string | null;
  unsubscribed_at: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DealStage {
  id: string;
  name: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface Deal {
  id: string;
  team_id: string;
  name: string;
  amount: number | null;
  currency: string;
  expected_close_date: string | null;
  probability: number | null;
  stage_id: string;
  stage: DealStage | null;
  contact_id: string | null;
  account_id: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  team_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  currency: string;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  team_id: string;
  type: string;
  contact_id: string | null;
  account_id: string | null;
  deal_id: string | null;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  ai_generated: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  assigned_to_user_id: string;
  assigned_to_name: string | null;
  contact_id: string | null;
  deal_id: string | null;
  status: string;
  ai_proposed: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  team_id: string;
  user_id: string;
  goal: string;
  context: Record<string, unknown> | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_cost_usd: number;
  created_at: string;
}

export interface Approval {
  id: string;
  team_id: string;
  run_id: string;
  type: string;
  draft_content: Record<string, unknown>;
  reasoning: string | null;
  compliance_result: Record<string, unknown> | null;
  assigned_to_user_id: string;
  assigned_to_name: string | null;
  status: string;
  decided_at: string | null;
  expires_at: string;
  time_remaining_seconds: number | null;
  created_at: string;
}

// API functions
export const accountsApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Account>>("/accounts", { params }),
  get: (id: string) => api.get<Account & { contacts_count: number; deals_total_amount: number }>(`/accounts/${id}`),
  create: (data: Partial<Account>) => api.post<Account>("/accounts", data),
  update: (id: string, data: Partial<Account>) => api.put<Account>(`/accounts/${id}`, data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

export const contactsApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Contact>>("/contacts", { params }),
  get: (id: string) => api.get<Contact & { activities_count: number; deals_count: number }>(`/contacts/${id}`),
  create: (data: Partial<Contact>) => api.post<Contact>("/contacts", data),
  update: (id: string, data: Partial<Contact>) => api.put<Contact>(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  consent: (id: string, data: { type: string; action: string; source?: string }) =>
    api.post(`/contacts/${id}/consent`, data),
};

export const dealsApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Deal>>("/deals", { params }),
  get: (id: string) => api.get(`/deals/${id}`),
  create: (data: Partial<Deal>) => api.post<Deal>("/deals", data),
  update: (id: string, data: Partial<Deal>) => api.put<Deal>(`/deals/${id}`, data),
  delete: (id: string) => api.delete(`/deals/${id}`),
  stages: () => api.get<DealStage[]>("/deals/stages"),
  transitionStage: (id: string, stageId: string) => api.put(`/deals/${id}/stage`, { stage_id: stageId }),
};

export const productsApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Product>>("/products", { params }),
  get: (id: string) => api.get<Product>(`/products/${id}`),
  create: (data: Partial<Product>) => api.post<Product>("/products", data),
  update: (id: string, data: Partial<Product>) => api.put<Product>(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

export const activitiesApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Activity>>("/activities", { params }),
  create: (data: Partial<Activity>) => api.post<Activity>("/activities", data),
};

export const tasksApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Task>>("/tasks", { params }),
  create: (data: Partial<Task>) => api.post<Task>("/tasks", data),
  update: (id: string, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

export const aiApi = {
  runs: {
    list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<AgentRun>>("/ai/runs", { params }),
    get: (id: string) => api.get(`/ai/runs/${id}`),
    create: (data: { goal: string; context: Record<string, unknown> }) => api.post<AgentRun>("/ai/runs", data),
    cancel: (id: string) => api.post(`/ai/runs/${id}/cancel`),
  },
  approvals: {
    list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Approval>>("/ai/approvals", { params }),
    get: (id: string) => api.get<Approval>(`/ai/approvals/${id}`),
    decide: (id: string, data: { action: string; edited_content?: Record<string, unknown> }) =>
      api.post(`/ai/approvals/${id}/decide`, data),
  },
  audit: (params?: Record<string, unknown>) => api.get("/ai/audit", { params }),
};
