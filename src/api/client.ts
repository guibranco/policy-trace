import {
  ApiProblemError,
  mockArchiveMessages,
  mockEditAndRetryMessage,
  mockGetConfig,
  mockGetConversation,
  mockGetEndpoints,
  mockGetLogs,
  mockGetMessage,
  mockGetMessages,
  mockGetRelatedTickets,
  mockGetSaga,
  mockLookupPolicy,
  mockRetryMessages,
  mockUnarchiveMessage,
} from "./mock";
import {
  type ActionResult,
  type AppConfig,
  type ConversationGraph,
  type LogEvent,
  type LookupResult,
  type MessageDetail,
  type MessageSummary,
  type Paged,
  type ProblemDetails,
  type RelatedTicketsResult,
  type SagaHistory,
} from "./types";

export const USE_MOCK = true;

export const OPERATOR_STORAGE_KEY = "policytrace_operator";

export function getOperatorName(): string {
  try {
    return localStorage.getItem(OPERATOR_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setOperatorName(name: string): void {
  try {
    localStorage.setItem(OPERATOR_STORAGE_KEY, name.trim());
  } catch {
    // ignore storage errors
  }
}

type QueryValue = string | number | boolean | string[] | null | undefined;

function buildQuery(params: Record<string, QueryValue>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length > 0) sp.set(k, v.join(","));
    } else {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isPost = init?.method?.toUpperCase() === "POST";
  const headers = new Headers(init?.headers);

  if (isPost) {
    headers.set("X-Requested-With", "PolicyTrace");
    const op = getOperatorName();
    if (op) {
      headers.set("X-Operator", op);
    }
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let problem: ProblemDetails = {
      title: res.status === 403 ? "Action Disabled" : `HTTP ${res.status} Error`,
      detail:
        res.status === 403
          ? "This action is disabled in the current environment."
          : res.statusText || "An unexpected error occurred.",
      status: res.status,
    };
    try {
      const json: unknown = await res.json();
      if (json && typeof json === "object") {
        const body = json as Partial<ProblemDetails>;
        problem = {
          title: body.title || problem.title,
          detail: body.detail || problem.detail,
          status: body.status || res.status,
        };
      }
    } catch {
      // fallback to statusText
    }
    throw new ApiProblemError(problem);
  }

  return (await res.json()) as T;
}

// GET /api/config -> AppConfig
export async function getConfig(): Promise<AppConfig> {
  if (USE_MOCK) return mockGetConfig();
  return request<AppConfig>("/api/config");
}

// GET /api/endpoints -> string[]
export async function getEndpoints(): Promise<string[]> {
  if (USE_MOCK) return mockGetEndpoints();
  return request<string[]>("/api/endpoints");
}

// GET /api/lookup/{policyNumber}?from=&to=&includeNoise= -> LookupResult
export async function lookupPolicy(
  policyNumber: string,
  params?: { from?: string; to?: string; includeNoise?: boolean }
): Promise<LookupResult> {
  if (USE_MOCK) return mockLookupPolicy(policyNumber, params);
  const qs = buildQuery({
    from: params?.from,
    to: params?.to,
    includeNoise: params?.includeNoise,
  });
  return request<LookupResult>(
    `/api/lookup/${encodeURIComponent(policyNumber)}${qs}`
  );
}

// GET /api/messages?endpoint=&status=&q=&page=&pageSize=&sort=&direction= -> Paged<MessageSummary>
export async function getMessages(params?: {
  endpoint?: string;
  status?: string | string[];
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: string;
}): Promise<Paged<MessageSummary>> {
  if (USE_MOCK) return mockGetMessages(params);
  const qs = buildQuery(params || {});
  return request<Paged<MessageSummary>>(`/api/messages${qs}`);
}

// GET /api/messages/{id} -> MessageDetail
export async function getMessage(id: string): Promise<MessageDetail> {
  if (USE_MOCK) return mockGetMessage(id);
  return request<MessageDetail>(`/api/messages/${encodeURIComponent(id)}`);
}

// GET /api/conversations/{conversationId} -> ConversationGraph
export async function getConversation(
  conversationId: string
): Promise<ConversationGraph> {
  if (USE_MOCK) return mockGetConversation(conversationId);
  return request<ConversationGraph>(
    `/api/conversations/${encodeURIComponent(conversationId)}`
  );
}

// GET /api/sagas/{sagaId} -> SagaHistory
export async function getSaga(sagaId: string): Promise<SagaHistory> {
  if (USE_MOCK) return mockGetSaga(sagaId);
  return request<SagaHistory>(`/api/sagas/${encodeURIComponent(sagaId)}`);
}

// GET /api/tickets/related?policyNumber=&messageId=&from=&to= -> RelatedTicketsResult
export async function getRelatedTickets(params: {
  policyNumber?: string;
  messageId?: string;
  from?: string;
  to?: string;
}): Promise<RelatedTicketsResult> {
  if (USE_MOCK) return mockGetRelatedTickets(params);
  const qs = buildQuery(params);
  return request<RelatedTicketsResult>(`/api/tickets/related${qs}`);
}

// GET /api/logs?policyNumber=&conversationId=&messageId=&requestId=&sessionId=&level=&includeNoise=&from=&to=&count= -> LogEvent[]
export async function getLogs(params: {
  policyNumber?: string;
  conversationId?: string;
  messageId?: string;
  requestId?: string;
  sessionId?: string;
  level?: string;
  includeNoise?: boolean;
  from?: string;
  to?: string;
  count?: number;
}): Promise<LogEvent[]> {
  if (USE_MOCK) return mockGetLogs(params);
  const qs = buildQuery(params);
  return request<LogEvent[]>(`/api/logs${qs}`);
}

// POST /api/messages/{id}/retry -> ActionResult (202)
export async function retryMessage(id: string): Promise<ActionResult> {
  if (USE_MOCK) return mockRetryMessages([id]);
  return request<ActionResult>(
    `/api/messages/${encodeURIComponent(id)}/retry`,
    { method: "POST" }
  );
}

// POST /api/messages/retry { ids } -> ActionResult (202)
export async function retryMessages(ids: string[]): Promise<ActionResult> {
  if (USE_MOCK) return mockRetryMessages(ids);
  return request<ActionResult>(`/api/messages/retry`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// POST /api/messages/{id}/archive -> ActionResult
export async function archiveMessage(id: string): Promise<ActionResult> {
  if (USE_MOCK) return mockArchiveMessages([id]);
  return request<ActionResult>(
    `/api/messages/${encodeURIComponent(id)}/archive`,
    { method: "POST" }
  );
}

// POST /api/messages/archive { ids } -> ActionResult
export async function archiveMessages(ids: string[]): Promise<ActionResult> {
  if (USE_MOCK) return mockArchiveMessages(ids);
  return request<ActionResult>(`/api/messages/archive`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// POST /api/messages/{id}/unarchive -> ActionResult
export async function unarchiveMessage(id: string): Promise<ActionResult> {
  if (USE_MOCK) return mockUnarchiveMessage(id);
  return request<ActionResult>(
    `/api/messages/${encodeURIComponent(id)}/unarchive`,
    { method: "POST" }
  );
}

// POST /api/messages/{id}/edit-retry { body, headers } -> ActionResult (202)
export async function editAndRetryMessage(
  id: string,
  payload: { body: string; headers: Record<string, string> }
): Promise<ActionResult> {
  if (USE_MOCK) return mockEditAndRetryMessage(id, payload);
  return request<ActionResult>(
    `/api/messages/${encodeURIComponent(id)}/edit-retry`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}
