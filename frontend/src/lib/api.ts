import type {
  DashboardData,
  DataQuality,
  IncidentDetail,
  ListResponse,
  Incident,
  AffectedUnit,
  ReviewEvent,
  ReviewDecision,
  SiteConfig,
  TransportAlert,
  AuthenticatedUser,
  StaffReportRequest,
  InvestigationNote,
  CaseWorkflow,
  PendingCaseReview,
} from "@/lib/types";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000")
).replace(/\/+$/, "");
const CACHE_PREFIX = "trustledger-api-cache:";
const OUTBOX_KEY = "trustledger-review-outbox";
const CONNECTION_EVENT = "trustledger:offline-state";

export interface ReviewSubmission {
  review_id: string;
  incident_id: string;
  decision: ReviewDecision;
  reason: string;
  changed_assessment: string | null;
}

export interface DemoLoginCredentials {
  username: string;
  password: string;
  remember_me?: boolean;
}

export interface ReviewResponse {
  status: "recorded" | "already_recorded" | "queued_offline";
  review: ReviewEvent;
  notice: string;
}

function uniqueReviewEvents(events: ReviewEvent[]): ReviewEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.review_id)) return false;
    seen.add(event.review_id);
    return true;
  });
}

function announceConnection(state: "online" | "offline" | "stale" | "sync-error" | "cache-error") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONNECTION_EVENT, { detail: { state } }),
    );
  }
}

function readCache<T>(path: string): T | null {
  if (typeof window === "undefined") return null;
  const key = `${CACHE_PREFIX}${path}`;
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      announceConnection("cache-error");
    }
    announceConnection("cache-error");
    return null;
  }
}

function writeCache(path: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${path}`, JSON.stringify(value));
  } catch {
    announceConnection("cache-error");
  }
}

function offlineValue<T>(path: string): T | null {
  const cached = readCache<T>(path);
  if (cached !== null) announceConnection("stale");
  return cached;
}

async function responseError(response: Response): Promise<Error> {
  let detail = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    // Keep the HTTP status when the server does not return JSON.
  }
  return new Error(detail);
}

async function request<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const isAuthCheck = path === "/api/auth/me";
  const isSensitiveRead = isAuthCheck || path.startsWith("/api/audit-log") ||
    path.startsWith("/api/reviews") || path.startsWith("/api/case-history") ||
    path.includes("/notes") ||
    path.includes("/workflow") || path.startsWith("/api/review-queue");
  let response: Response;
  try {
    response = await fetch(url, { credentials: "include" });
  } catch {
    if (isAuthCheck) {
      announceConnection("offline");
      throw new Error("Could not verify your demo session. Reconnect and sign in again.");
    }
    const cached = offlineValue<T>(path);
    if (cached !== null) return cached;
    announceConnection("offline");
    throw new Error(
      `Could not connect to the TrustLedger API at ${API_BASE_URL}. No cached copy of this view is available.`,
    );
  }

  if (!response.ok) {
    const error = await responseError(response);
    if (response.status >= 500 && !isSensitiveRead) {
      const cached = offlineValue<T>(path);
      if (cached !== null) return cached;
    }
    throw error;
  }

  const data = (await response.json()) as T;
  if (!isSensitiveRead) writeCache(path, data);
  announceConnection("online");
  return data;
}

function listQuery(limit: number, offset: number, search: string) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search.trim()) params.set("search", search.trim());
  return params.toString();
}

export function fetchDashboard() {
  return request<DashboardData>("/api/dashboard");
}

export function fetchCurrentUser() {
  return request<AuthenticatedUser>("/api/auth/me");
}

export async function loginDemoUser(credentials: DemoLoginCredentials) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as { user: AuthenticatedUser; expires_in: number };
}

export async function logoutDemoUser() {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw await responseError(response);
}

export function fetchSiteConfig() {
  return request<SiteConfig>("/api/config");
}

export function fetchDataQuality() {
  return request<DataQuality>("/api/data-quality");
}

export function fetchIncidents(limit = 50, offset = 0, search = "", view: "active" | "historical" | "all" = "all") {
  return request<ListResponse<Incident>>(
    `/api/incidents?${listQuery(limit, offset, search)}&view=${view}`,
  );
}

export function fetchTransportAlerts(limit = 50, offset = 0, search = "") {
  return request<ListResponse<TransportAlert>>(
    `/api/transport-alerts?${listQuery(limit, offset, search)}`,
  );
}

export function fetchIncidentDetail(incidentId: string) {
  return request<IncidentDetail>(
    `/api/incidents/${encodeURIComponent(incidentId)}`,
  );
}

export function fetchAffectedUnits(
  limit = 50,
  offset = 0,
  search = "",
  strategy: "sustained" | "baseline" = "sustained",
) {
  return request<ListResponse<AffectedUnit>>(
    `/api/units/affected?${listQuery(limit, offset, search)}&strategy=${strategy}`,
  );
}

export function fetchReviewAudit() {
  return request<ListResponse<ReviewEvent>>("/api/audit-log?limit=100&offset=0");
}

export function getPendingReviews(user?: AuthenticatedUser): ReviewEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const serialized = window.localStorage.getItem(OUTBOX_KEY);
    if (!serialized) return [];
    const storedEvents = JSON.parse(serialized) as ReviewEvent[];
    const events = uniqueReviewEvents(storedEvents);
    if (events.length !== storedEvents.length) {
      try {
        window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(events));
      } catch {
        announceConnection("cache-error");
      }
    }
    return user
      ? events.filter((event) => event.actor_name === user.actor_name && event.role === user.role)
      : events;
  } catch {
    try {
      window.localStorage.removeItem(OUTBOX_KEY);
    } catch {
      announceConnection("cache-error");
    }
    announceConnection("cache-error");
    return [];
  }
}

// Older unsynced review drafts remain visible as legacy local entries.
// We deliberately do not auto-transmit them into the new stateful review process.
async function postReview(submission: ReviewSubmission): Promise<ReviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as ReviewResponse;
}

export async function submitReview(
  submission: ReviewSubmission,
  _user: AuthenticatedUser,
): Promise<ReviewResponse> {
  void _user;
  try {
    const response = await postReview(submission);
    announceConnection("online");
    return response;
  } catch (error) {
    if (error instanceof TypeError) {
      announceConnection("offline");
      throw new Error("Review was NOT saved. Reconnect, reopen the case and submit again.");
    }
    throw error;
  }
}

/** Never auto-sync legacy pending decisions into a new case state. */
export async function syncPendingReviews(_user: AuthenticatedUser): Promise<number> {
  void _user;
  return 0;
}

/** Live online-only staff report. Unlike reviews, never queue a report invisibly. */
export async function createStaffIncident(report: StaffReportRequest): Promise<{incident: Incident}> {
  const response = await fetch(`${API_BASE_URL}/api/incidents/report`, {
    method: "POST", credentials: "include",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(report),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as {incident: Incident};
}

export function fetchInvestigationNotes(reference: string) {
  return request<{items: InvestigationNote[]}>(`/api/incidents/${encodeURIComponent(reference)}/notes`);
}

export async function saveInvestigationNote(reference: string, finding: string) {
  const response = await fetch(`${API_BASE_URL}/api/incidents/${encodeURIComponent(reference)}/notes`, {
    method: "POST", credentials: "include",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({finding}),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as {note: InvestigationNote};
}

async function postWorkflow<T>(path: string, payload: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_BASE_URL + path, {
      method:"POST",
      credentials:"include",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
    });
  } catch {
    announceConnection("offline");
    throw new Error("No changes were saved. Check your connection and try again.");
  }
  if (!response.ok) throw await responseError(response);
  announceConnection("online");
  return (await response.json()) as T;
}

export function fetchCaseWorkflow(reference: string) {
  return request<CaseWorkflow>("/api/incidents/"+encodeURIComponent(reference)+"/workflow");
}

export function fetchReviewQueue() {
  return request<{items:PendingCaseReview[]}>("/api/review-queue");
}

export function submitInvestigation(reference:string, summary:string) {
  return postWorkflow<CaseWorkflow>(
    "/api/incidents/"+encodeURIComponent(reference)+"/submit",{summary}
  );
}

export function createCaseFollowup(reference:string,description:string,due_at:string|null) {
  return postWorkflow<CaseWorkflow>(
    "/api/incidents/"+encodeURIComponent(reference)+"/followups",{description,due_at}
  );
}

export function completeCaseFollowup(reference:string,actionId:string,completion_note:string) {
  return postWorkflow<CaseWorkflow>(
    "/api/incidents/"+encodeURIComponent(reference)+"/followups/"+
      encodeURIComponent(actionId)+"/complete",{completion_note}
  );
}

export function closeInvestigation(reference:string,reason:string) {
  return postWorkflow<CaseWorkflow>(
    "/api/incidents/"+encodeURIComponent(reference)+"/close",{reason}
  );
}

export function fetchCaseHistory() {
  return request<ListResponse<import("@/lib/types").CaseEvent>>(
    "/api/case-history?limit=100&offset=0"
  );
}

export interface ReceivedObservation {
  source_system: string;
  source_event_id: string;
  facility_id: string;
  observed_at: string;
  temperature_c: number;
  received_at: string;
}

export function fetchReceivedObservations() {
  return request<{total: number; items: ReceivedObservation[]; notice: string}>(
    "/api/connectors/received-observations?limit=12",
  );
}


export interface ABBISSourceRecord {
  dataset: string;
  record_id: string;
  facility_id: string | null;
  summary: string;
  observed_at: string | null;
  record_sha256: string;
  source_system: "ABBIS-SANDBOX";
  source_revision: string;
}

export function fetchABBISCatalog() {
  return request<{
    datasets: { id: string; count: number }[];
    source_revision: string;
  }>("/api/abbis/catalog");
}

export function searchABBISSource(dataset: string, query: string) {
  return request<{
    dataset: string;
    total: number;
    items: ABBISSourceRecord[];
  }>("/api/abbis/records/search?dataset=" + encodeURIComponent(dataset)
     + "&q=" + encodeURIComponent(query.trim()));
}
