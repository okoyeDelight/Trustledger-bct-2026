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
} from "@/lib/types";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");
const CACHE_PREFIX = "trustledger-api-cache:";
const OUTBOX_KEY = "trustledger-review-outbox";
const CONNECTION_EVENT = "trustledger:offline-state";
let pendingReviewSync: Promise<number> | null = null;

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
  const isSensitiveRead = isAuthCheck || path.startsWith("/api/audit-log") || path.startsWith("/api/reviews");
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

export function fetchIncidents(limit = 50, offset = 0, search = "") {
  return request<ListResponse<Incident>>(
    `/api/incidents?${listQuery(limit, offset, search)}`,
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

function savePendingReviews(events: ReviewEvent[]) {
  if (typeof window === "undefined") {
    throw new Error("Offline review storage is available only in the browser.");
  }
  try {
    const uniqueEvents = uniqueReviewEvents(events);
    if (uniqueEvents.length) {
      window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(uniqueEvents));
    } else {
      window.localStorage.removeItem(OUTBOX_KEY);
    }
  } catch {
    throw new Error("This device could not save the offline review. Free browser storage and retry.");
  }
}

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
  user: AuthenticatedUser,
): Promise<ReviewResponse> {
  try {
    const response = await postReview(submission);
    announceConnection("online");
    return response;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const event: ReviewEvent = {
      ...submission,
      actor_name: user.actor_name,
      role: user.role,
      created_at: new Date().toISOString(),
      sync_status: "pending_sync",
    };
    savePendingReviews([...getPendingReviews(), event]);
    announceConnection("offline");
    return {
      status: "queued_offline",
      review: event,
      notice: "Saved on this device only. It will sync when the API is reachable.",
    };
  }
}

export async function syncPendingReviews(user: AuthenticatedUser): Promise<number> {
  if (pendingReviewSync) return pendingReviewSync;
  const sync = syncPendingReviewsOnce(user);
  const trackedSync = sync.finally(() => {
    if (pendingReviewSync === trackedSync) pendingReviewSync = null;
  });
  pendingReviewSync = trackedSync;
  return trackedSync;
}

async function syncPendingReviewsOnce(user: AuthenticatedUser): Promise<number> {
  const pending = getPendingReviews();
  if (!pending.length || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return 0;
  }

  const syncedReviewIds = new Set<string>();
  let synced = 0;
  for (let index = 0; index < pending.length; index += 1) {
    const event = pending[index];
    if (event.actor_name !== user.actor_name || event.role !== user.role) {
      continue;
    }
    try {
      await postReview({
        review_id: event.review_id,
        incident_id: event.incident_id,
        decision: event.decision,
        reason: event.reason,
        changed_assessment: event.changed_assessment,
      });
      synced += 1;
      syncedReviewIds.add(event.review_id);
    } catch (error) {
      savePendingReviews(
        getPendingReviews().filter((queued) => !syncedReviewIds.has(queued.review_id)),
      );
      if (error instanceof TypeError) {
        announceConnection("offline");
        return synced;
      }
      announceConnection("sync-error");
      throw error;
    }
  }
  savePendingReviews(
    getPendingReviews().filter((event) => !syncedReviewIds.has(event.review_id)),
  );
  announceConnection("online");
  return synced;
}
