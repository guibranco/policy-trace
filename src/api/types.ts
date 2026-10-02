export type MessageStatus =
  | "successful"
  | "failed"
  | "repeatedFailure"
  | "retryIssued"
  | "resolved"
  | "archived";

export interface AppConfig {
  environmentName: string; // "INT" | "STG" | "PROD"
  seqPublicUrl: string;
  servicePulsePublicUrl: string;
  actions: {
    retry: boolean;
    archive: boolean;
    edit: boolean;
    maxBatchSize: number;
  };
  defaultLookbackDays: number;
  policyNumberPattern: string; // regex, validate input client-side
  jira: { enabled: boolean; baseUrl: string | null };
}

export interface MessageSummary {
  id: string;
  messageId: string;
  messageType: string;
  status: MessageStatus;
  sendingEndpoint: string | null;
  receivingEndpoint: string | null;
  timeSent: string | null;
  processedAt: string | null;
  conversationId: string | null;
  sagaIds: string[];
  exceptionType: string | null;
  exceptionMessage: string | null;
  numberOfProcessingAttempts: number | null;
  servicePulseUrl: string | null;
}

export interface MessageDetail extends MessageSummary {
  headers: Record<string, string>;
  body: string | null;
  bodyContentType: string | null;
  bodyEditable: boolean;
  lockedHeaders: string[];
  stackTrace: string | null;
}

export interface LogEvent {
  id: string;
  timestamp: string;
  level: string; // Verbose, Debug, Information, Warning, Error, Fatal
  renderedMessage: string;
  exception: string | null;
  application: string | null;
  conversationId: string | null;
  messageId: string | null;
  requestId: string | null;
  sessionId: string | null;
  traceId: string | null;
  properties: Record<string, unknown>;
  seqUrl: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface TimelineItem {
  kind: "message" | "log";
  timestamp: string;
  message?: MessageSummary;
  log?: LogEvent;
}

export interface SourceState {
  ok: boolean;
  error: string | null;
  durationMs: number;
}

export interface LookupResult {
  policyNumber: string;
  from: string;
  to: string;
  conversationIds: string[];
  items: TimelineItem[];
  truncated: { messages: boolean; logs: boolean };
  hiddenNoiseCount: number;
  sources: { seq: SourceState; serviceControl: SourceState };
}

export interface ConversationGraph {
  conversationId: string;
  nodes: Array<{
    id: string;
    messageId: string;
    messageType: string;
    intent: "send" | "publish" | "reply" | "unknown";
    status: MessageStatus;
    sendingEndpoint: string | null;
    receivingEndpoint: string | null;
    timeSent: string | null;
    processedAt: string | null;
    sagaIds: string[];
  }>;
  edges: Array<{ from: string; to: string }>;
}

export interface SagaMessage {
  messageId: string;
  messageType: string;
  intent: string;
  timeSent: string | null;
  isTimeout: boolean;
  deliveryDelay: string | null;
  destination: string | null;
}

export interface SagaHistory {
  sagaId: string;
  sagaType: string;
  changes: Array<{
    startTime: string;
    finishTime: string;
    status: "new" | "updated" | "completed";
    stateAfterChange: string; // JSON string
    endpoint: string;
    initiatingMessage: SagaMessage;
    outgoingMessages: SagaMessage[];
  }>;
}

export interface JiraTicket {
  key: string; // e.g. CORE-1234
  summary: string;
  issueType: string;
  status: string;
  statusCategory: "todo" | "inProgress" | "done";
  priority: string | null;
  assignee: string | null;
  components: string[];
  labels: string[];
  fixVersions: string[];
  created: string;
  updated: string;
  resolved: string | null;
  url: string; // link to the ticket in Jira
  excerpt: string | null; // plain-text snippet around the match
}

export interface RelatedTicket {
  ticket: JiraTicket;
  relation: "mentionsPolicy" | "matchesError" | "recentChange";
  hint: "possibleCause" | "possibleFix" | "related";
  reason: string; // one sentence explaining the match
}

export interface RelatedTicketsResult {
  enabled: boolean; // false when Jira is not configured
  ok: boolean;
  error: string | null;
  tickets: RelatedTicket[];
  truncated: boolean;
}

export interface ActionResult {
  requested: number;
  accepted: number;
  failures: Array<{ id: string; reason: string }>;
}

export interface ProblemDetails {
  title: string;
  detail: string;
  status: number;
}
