import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  Edit3,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Search,
  Workflow,
  X,
} from "lucide-react";
import {
  getConversation,
  getLogs,
  getMessage,
  getRelatedTickets,
} from "../api/client";
import {
  AppConfig,
  ConversationGraph,
  LogEvent,
  MessageDetail,
  MessageSummary,
  RelatedTicketsResult,
} from "../api/types";
import {
  extractProblemDetails,
  formatLocalTime,
  shortTypeName,
} from "../utils/format";
import {
  CopyButton,
  EmptyState,
  ErrorState,
  LogLevelBadge,
  SkeletonRows,
  StatusBadge,
  TimestampCell,
} from "./Common";
import { ConversationDiagram } from "./ConversationDiagram";
import { RelatedTicketsPanel } from "./RelatedTicketsPanel";

export type DetailTab =
  | "overview"
  | "body"
  | "headers"
  | "exception"
  | "logs"
  | "flow"
  | "tickets";

function highlightPayload(
  raw: string,
  contentType: string | null
): React.ReactNode {
  const isXml =
    contentType?.includes("xml") || raw.trim().startsWith("<");

  if (isXml) {
    return raw.split("\n").map((line, i) => (
      <div key={i} className="leading-relaxed">
        <span className="inline-block w-7 select-none text-text-muted opacity-50 tabular-nums">
          {i + 1}
        </span>
        <span className="text-text-primary">{line}</span>
      </div>
    ));
  }

  let formatted = raw;
  try {
    formatted = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // keep raw if not valid json
  }

  const lines = formatted.split("\n");
  return lines.map((line, i) => {
    const kvMatch = line.match(/^(\s*"[^"]+":\s*)(.*)$/);
    return (
      <div key={i} className="leading-relaxed">
        <span className="inline-block w-7 select-none text-text-muted opacity-50 tabular-nums">
          {i + 1}
        </span>
        {kvMatch ? (
          <>
            <span className="text-brand-purple font-semibold">
              {kvMatch[1]}
            </span>
            <span className="text-text-primary">{kvMatch[2]}</span>
          </>
        ) : (
          <span className="text-text-primary">{line}</span>
        )}
      </div>
    );
  });
}

export const MessageDetailView: React.FC<{
  messageId: string;
  config: AppConfig;
  isDrawer?: boolean;
  refreshToken?: number;
  onClose?: () => void;
  onSelectMessage: (id: string) => void;
  onTriggerAction: (
    action: "retry" | "archive" | "unarchive" | "editRetry",
    messages: MessageSummary[],
    detail?: MessageDetail
  ) => void;
  onOpenPivotLogs?: (filter: {
    requestId?: string;
    sessionId?: string;
  }) => void;
}> = ({
  messageId,
  config,
  isDrawer = true,
  refreshToken = 0,
  onClose,
  onSelectMessage,
  onTriggerAction,
  onOpenPivotLogs,
}) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<
    typeof extractProblemDetails
  > | null>(null);

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [rawBodyMode, setRawBodyMode] = useState(false);
  const [headerQuery, setHeaderQuery] = useState("");

  // Tab-specific states
  const [logs, setLogs] = useState<LogEvent[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<ReturnType<
    typeof extractProblemDetails
  > | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [flowGraph, setFlowGraph] = useState<ConversationGraph | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState<ReturnType<
    typeof extractProblemDetails
  > | null>(null);

  const [ticketsResult, setTicketsResult] =
    useState<RelatedTicketsResult | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getMessage(messageId);
      setDetail(d);
    } catch (e) {
      setError(extractProblemDetails(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLogs(null);
    setFlowGraph(null);
    setTicketsResult(null);
    loadDetail();
  }, [messageId, refreshToken]);

  const isFailedOrHasException = useMemo(() => {
    if (!detail) return false;
    return (
      detail.status === "failed" ||
      detail.status === "repeatedFailure" ||
      Boolean(detail.exceptionType || detail.exceptionMessage || detail.stackTrace)
    );
  }, [detail]);

  // Reset tab if switching to a message without exception/tickets
  useEffect(() => {
    if (!detail) return;
    if (
      (activeTab === "exception" || activeTab === "tickets") &&
      !isFailedOrHasException
    ) {
      setActiveTab("overview");
    }
  }, [detail, isFailedOrHasException, activeTab]);

  // Lazy load tab data when selected
  const loadTabLogs = async () => {
    if (!detail) return;
    setLogsLoading(true);
    setLogsError(null);
    try {
      const data = await getLogs({
        messageId: detail.messageId,
        conversationId: detail.conversationId || undefined,
      });
      setLogs(data);
    } catch (e) {
      setLogsError(extractProblemDetails(e));
    } finally {
      setLogsLoading(false);
    }
  };

  const loadTabFlow = async () => {
    if (!detail?.conversationId) return;
    setFlowLoading(true);
    setFlowError(null);
    try {
      const g = await getConversation(detail.conversationId);
      setFlowGraph(g);
    } catch (e) {
      setFlowError(extractProblemDetails(e));
    } finally {
      setFlowLoading(false);
    }
  };

  const loadTabTickets = async () => {
    if (!detail) return;
    setTicketsLoading(true);
    try {
      const res = await getRelatedTickets({ messageId: detail.id });
      setTicketsResult(res);
    } catch (e) {
      const prob = extractProblemDetails(e);
      setTicketsResult({
        enabled: true,
        ok: false,
        error: prob.detail,
        tickets: [],
        truncated: false,
      });
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    if (!detail) return;
    if (activeTab === "logs" && logs === null && !logsLoading) {
      loadTabLogs();
    } else if (activeTab === "flow" && flowGraph === null && !flowLoading) {
      loadTabFlow();
    } else if (
      activeTab === "tickets" &&
      ticketsResult === null &&
      !ticketsLoading
    ) {
      loadTabTickets();
    }
  }, [activeTab, detail]);

  const filteredHeaders = useMemo(() => {
    if (!detail) return [];
    const entries = Object.entries(detail.headers || {});
    if (!headerQuery.trim()) return entries;
    const q = headerQuery.toLowerCase();
    return entries.filter(
      ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
    );
  }, [detail, headerQuery]);

  const canRetryStatus =
    detail &&
    (detail.status === "failed" ||
      detail.status === "repeatedFailure" ||
      detail.status === "archived");
  const canArchiveStatus =
    detail &&
    (detail.status === "failed" || detail.status === "repeatedFailure");
  const isArchived = detail?.status === "archived";

  const tabs: Array<{ id: DetailTab; label: string; show: boolean }> = [
    { id: "overview", label: "Overview", show: true },
    { id: "body", label: "Body", show: true },
    {
      id: "headers",
      label: `Headers (${detail ? Object.keys(detail.headers).length : 0})`,
      show: true,
    },
    { id: "exception", label: "Exception", show: isFailedOrHasException },
    { id: "logs", label: "Logs", show: true },
    { id: "flow", label: "Flow", show: Boolean(detail?.conversationId) },
    {
      id: "tickets",
      label: "Tickets",
      show: isFailedOrHasException && config.jira.enabled,
    },
  ];

  return (
    <div
      data-testid="message-detail-container"
      className="flex flex-col h-full bg-surface text-text-primary"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border-subtle bg-surface-subtle flex items-start justify-between gap-4 shrink-0">
        <div className="min-w-0 flex-1">
          {detail ? (
            <>
              <div className="flex items-center gap-2.5 flex-wrap">
                <StatusBadge status={detail.status} />
                <h2
                  title={detail.messageType}
                  className="font-mono text-sm font-semibold text-text-primary truncate"
                >
                  {shortTypeName(detail.messageType)}
                </h2>
                <CopyButton value={detail.messageId} label="Copy ID" />
              </div>
              <div className="mt-1 font-mono text-[11px] text-text-muted truncate">
                {detail.messageType}
              </div>
            </>
          ) : (
            <div className="text-sm font-semibold text-text-primary">
              Message Details ({messageId})
            </div>
          )}
        </div>

        {/* Action buttons in the header */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {detail && (
            <>
              {/* Retry button */}
              <button
                type="button"
                data-testid="drawer-action-retry"
                disabled={!config.actions.retry || !canRetryStatus}
                title={
                  !config.actions.retry
                    ? "Retry is disabled in this environment"
                    : !canRetryStatus
                    ? `Cannot retry a message with status '${detail.status}'`
                    : "Queue message for immediate retry"
                }
                onClick={() => onTriggerAction("retry", [detail], detail)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-brand-purple hover:bg-brand-purple-dark text-text-on-purple disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>

              {/* Archive / Unarchive button */}
              {isArchived ? (
                <button
                  type="button"
                  data-testid="drawer-action-unarchive"
                  disabled={!config.actions.archive}
                  title={
                    !config.actions.archive
                      ? "Archive actions are disabled in this environment"
                      : "Restore message from archive"
                  }
                  onClick={() => onTriggerAction("unarchive", [detail], detail)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  <span>Unarchive</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="drawer-action-archive"
                  disabled={!config.actions.archive || !canArchiveStatus}
                  title={
                    !config.actions.archive
                      ? "Archiving is disabled in this environment"
                      : !canArchiveStatus
                      ? `Only failed messages can be archived (current: '${detail.status}')`
                      : "Archive failed message"
                  }
                  onClick={() => onTriggerAction("archive", [detail], detail)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive</span>
                </button>
              )}

              {/* Edit and retry button */}
              <button
                type="button"
                data-testid="drawer-action-edit-retry"
                disabled={
                  !config.actions.edit ||
                  !detail.bodyEditable ||
                  !canRetryStatus
                }
                title={
                  !config.actions.edit
                    ? "Edit and retry is disabled in this environment"
                    : !detail.bodyEditable
                    ? "This message payload is not editable (non-JSON or locked schema)"
                    : !canRetryStatus
                    ? `Only failed messages can be edited and retried`
                    : "Edit JSON payload or headers and dispatch a replacement message"
                }
                onClick={() => onTriggerAction("editRetry", [detail], detail)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit and retry</span>
              </button>
            </>
          )}

          {isDrawer && onClose && (
            <button
              type="button"
              data-testid="drawer-close-button"
              onClick={onClose}
              title="Close drawer (Esc)"
              className="p-1.5 rounded hover:bg-surface-hover text-text-secondary cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-5 border-b border-border-subtle bg-surface flex items-center gap-1 overflow-x-auto shrink-0">
        {tabs
          .filter((t) => t.show)
          .map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`drawer-tab-${t.id}`}
                onClick={() => setActiveTab(t.id)}
                style={
                  isActive
                    ? {
                        borderBottomColor: "var(--brand-lime)",
                        borderBottomWidth: "3px",
                      }
                    : undefined
                }
                className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  isActive
                    ? "text-text-primary font-semibold"
                    : "text-text-secondary hover:text-text-primary border-b-[3px] border-transparent"
                }`}
              >
                {t.label}
              </button>
            );
          })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <SkeletonRows count={6} />
        ) : error ? (
          <ErrorState problem={error} onRetry={loadDetail} />
        ) : !detail ? null : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div data-testid="tab-content-overview" className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                    <div className="text-[11px] text-text-muted">
                      Message ID
                    </div>
                    <div className="flex items-center justify-between gap-2 font-mono text-xs text-text-primary break-all">
                      <span>{detail.messageId}</span>
                      <CopyButton value={detail.messageId} />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                    <div className="text-[11px] text-text-muted">
                      Conversation ID
                    </div>
                    {detail.conversationId ? (
                      <div className="flex items-center justify-between gap-2 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            if (onClose) onClose();
                            navigate(`/conversations/${detail.conversationId}`);
                          }}
                          className="text-brand-purple hover:underline inline-flex items-center gap-1 cursor-pointer truncate"
                        >
                          <GitBranch className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {detail.conversationId}
                          </span>
                        </button>
                        <CopyButton value={detail.conversationId} />
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted">—</div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                    <div className="text-[11px] text-text-muted">
                      Sending Endpoint
                    </div>
                    <div className="font-mono text-xs font-medium text-text-primary">
                      {detail.sendingEndpoint || "—"}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                    <div className="text-[11px] text-text-muted">
                      Receiving Endpoint
                    </div>
                    <div className="font-mono text-xs font-medium text-text-primary">
                      {detail.receivingEndpoint || "—"}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                    <div className="text-[11px] text-text-muted">Time Sent</div>
                    <TimestampCell iso={detail.timeSent} />
                  </div>

                  <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                    <div className="text-[11px] text-text-muted">
                      Processed At
                    </div>
                    <TimestampCell iso={detail.processedAt} />
                  </div>

                  <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                    <div className="text-[11px] text-text-muted">
                      Processing Attempts
                    </div>
                    <div className="font-mono text-xs font-semibold text-text-primary tabular-nums">
                      {detail.numberOfProcessingAttempts ?? "—"}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                    <div className="text-[11px] text-text-muted">
                      Associated Sagas
                    </div>
                    {detail.sagaIds.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {detail.sagaIds.map((sId) => (
                          <button
                            key={sId}
                            type="button"
                            onClick={() => {
                              if (onClose) onClose();
                              navigate(`/sagas/${sId}`);
                            }}
                            className="inline-flex items-center gap-1 font-mono text-xs font-medium text-brand-purple hover:underline cursor-pointer"
                          >
                            <Workflow className="w-3.5 h-3.5" />
                            <span>{sId}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted">None</div>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle space-y-1">
                  <div className="text-[11px] text-text-muted">
                    Full Message Type
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-xs text-text-primary break-all">
                    <span>{detail.messageType}</span>
                    <CopyButton value={detail.messageType} />
                  </div>
                </div>

                {detail.servicePulseUrl && (
                  <div className="flex justify-end">
                    <a
                      href={detail.servicePulseUrl}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="open-in-servicepulse-link"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-brand-purple"
                    >
                      <span>Open in ServicePulse</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BODY */}
            {activeTab === "body" && (
              <div data-testid="tab-content-body" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-text-secondary font-mono">
                    Content-Type: {detail.bodyContentType || "text/plain"}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        data-testid="body-raw-toggle"
                        checked={rawBodyMode}
                        onChange={(e) => setRawBodyMode(e.target.checked)}
                        className="rounded border-border-strong text-brand-purple"
                      />
                      <span>Raw</span>
                    </label>
                    {detail.body && (
                      <CopyButton value={detail.body} label="Copy Body" />
                    )}
                  </div>
                </div>

                {detail.body ? (
                  <pre className="p-4 rounded-lg border border-border-subtle bg-surface-subtle font-mono text-xs overflow-x-auto">
                    {rawBodyMode
                      ? detail.body
                      : highlightPayload(detail.body, detail.bodyContentType)}
                  </pre>
                ) : (
                  <EmptyState
                    title="Empty Message Body"
                    description="No body payload was recorded for this message."
                  />
                )}
              </div>
            )}

            {/* TAB 3: HEADERS */}
            {activeTab === "headers" && (
              <div data-testid="tab-content-headers" className="space-y-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    data-testid="headers-search-input"
                    placeholder="Filter headers by key or value..."
                    value={headerQuery}
                    onChange={(e) => setHeaderQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>

                {filteredHeaders.length === 0 ? (
                  <EmptyState
                    title="No matching headers"
                    description="No headers matched your filter query."
                  />
                ) : (
                  <div className="rounded-lg border border-border-subtle overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-surface-subtle border-b border-border-subtle text-text-secondary">
                          <th className="py-2 px-3 font-semibold w-1/3">Key</th>
                          <th className="py-2 px-3 font-semibold">Value</th>
                          <th className="py-2 px-3 w-20 text-right">Copy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle font-mono">
                        {filteredHeaders.map(([k, v]) => (
                          <tr key={k} className="hover:bg-surface-hover">
                            <td className="py-2 px-3 text-text-secondary align-top break-all">
                              {k}
                            </td>
                            <td className="py-2 px-3 text-text-primary align-top break-all">
                              {v}
                            </td>
                            <td className="py-2 px-3 text-right align-top">
                              <CopyButton value={v} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: EXCEPTION */}
            {activeTab === "exception" && (
              <div data-testid="tab-content-exception" className="space-y-4">
                <div
                  className="p-4 rounded-lg border space-y-2"
                  style={{
                    backgroundColor: "var(--status-failed-bg)",
                    borderColor: "var(--status-failed-border)",
                    color: "var(--status-failed-text)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">
                      {detail.exceptionType || "System.Exception"}
                    </span>
                    <CopyButton
                      value={`${detail.exceptionType}: ${detail.exceptionMessage}\n${
                        detail.stackTrace || ""
                      }`}
                      label="Copy Exception"
                    />
                  </div>
                  <p className="text-xs font-mono leading-relaxed">
                    {detail.exceptionMessage || "No exception message recorded."}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-semibold text-text-secondary mb-1.5">
                    Stack Trace
                  </div>
                  <pre className="p-4 rounded-lg border border-border-subtle bg-surface-subtle font-mono text-xs text-text-primary overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {detail.stackTrace || "No stack trace captured."}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 5: LOGS */}
            {activeTab === "logs" && (
              <div data-testid="tab-content-logs" className="space-y-3">
                {logsLoading ? (
                  <SkeletonRows count={4} />
                ) : logsError ? (
                  <ErrorState problem={logsError} onRetry={loadTabLogs} />
                ) : !logs || logs.length === 0 ? (
                  <EmptyState
                    title="No correlated Seq logs"
                    description="No Seq log events were recorded with this messageId or conversationId."
                  />
                ) : (
                  <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
                    {logs.map((log) => {
                      const isExp = expandedLogId === log.id;
                      return (
                        <div key={log.id} className="bg-surface">
                          <div
                            onClick={() =>
                              setExpandedLogId(isExp ? null : log.id)
                            }
                            className="px-3 py-2.5 flex items-start gap-2.5 hover:bg-surface-hover cursor-pointer text-xs"
                          >
                            <span className="font-mono text-text-secondary whitespace-nowrap tabular-nums">
                              {formatLocalTime(log.timestamp)}
                            </span>
                            <LogLevelBadge level={log.level} />
                            <span className="font-mono text-text-primary flex-1 break-words">
                              {log.renderedMessage}
                            </span>
                          </div>
                          {isExp && (
                            <div className="px-4 py-3 bg-surface-subtle border-t border-border-subtle space-y-2.5 text-xs">
                              {log.exception && (
                                <pre
                                  className="p-2.5 rounded border font-mono text-[11px] overflow-x-auto whitespace-pre-wrap"
                                  style={{
                                    backgroundColor: "var(--status-failed-bg)",
                                    borderColor: "var(--status-failed-border)",
                                    color: "var(--status-failed-text)",
                                  }}
                                >
                                  {log.exception}
                                </pre>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                                {Object.entries(log.properties).map(
                                  ([k, v]) => (
                                    <div
                                      key={k}
                                      className="p-1.5 rounded bg-surface border border-border-subtle flex items-center justify-between gap-2"
                                    >
                                      <span className="text-text-muted truncate">
                                        {k}:{" "}
                                        <span className="text-text-primary">
                                          {String(v)}
                                        </span>
                                      </span>
                                      <CopyButton value={String(v)} />
                                    </div>
                                  )
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                                <div className="flex items-center gap-3">
                                  {log.requestId && onOpenPivotLogs && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPivotLogs({
                                          requestId: log.requestId!,
                                        })
                                      }
                                      className="text-xs font-medium text-brand-purple hover:underline cursor-pointer"
                                    >
                                      All logs for this request ({log.requestId}
                                      )
                                    </button>
                                  )}
                                  {log.sessionId && onOpenPivotLogs && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPivotLogs({
                                          sessionId: log.sessionId!,
                                        })
                                      }
                                      className="text-xs font-medium text-brand-purple hover:underline cursor-pointer"
                                    >
                                      All logs for this session ({log.sessionId}
                                      )
                                    </button>
                                  )}
                                </div>
                                <a
                                  href={log.seqUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-purple hover:underline"
                                >
                                  <span>Open in Seq</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: FLOW */}
            {activeTab === "flow" && (
              <div data-testid="tab-content-flow">
                {flowLoading ? (
                  <SkeletonRows count={5} height="h-16" />
                ) : flowError ? (
                  <ErrorState problem={flowError} onRetry={loadTabFlow} />
                ) : flowGraph ? (
                  <ConversationDiagram
                    graph={flowGraph}
                    highlightMessageId={detail.id}
                    onSelectMessage={(id) => onSelectMessage(id)}
                    onSelectSaga={(sId) => {
                      if (onClose) onClose();
                      navigate(`/sagas/${sId}`);
                    }}
                    heightClass="h-[460px]"
                  />
                ) : null}
              </div>
            )}

            {/* TAB 7: TICKETS */}
            {activeTab === "tickets" && (
              <div data-testid="tab-content-tickets">
                <RelatedTicketsPanel
                  result={ticketsResult}
                  loading={ticketsLoading}
                  onRetry={loadTabTickets}
                  highlightTerms={
                    detail.exceptionType
                      ? [
                          shortTypeName(detail.messageType),
                          shortTypeName(detail.exceptionType),
                        ]
                      : [shortTypeName(detail.messageType)]
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
