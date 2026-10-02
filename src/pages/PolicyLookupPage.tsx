import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  GitCommit,
  Layers,
  MessageSquare,
  Search,
  Terminal,
  Workflow,
  XCircle,
} from "lucide-react";
import { getRelatedTickets, lookupPolicy } from "../api/client";
import {
  type LogEvent,
  type LookupResult,
  type MessageSummary,
  type RelatedTicket,
  type RelatedTicketsResult,
} from "../api/types";
import {
  CopyButton,
  EmptyState,
  ErrorState,
  LogLevelBadge,
  SkeletonRows,
  StatusBadge,
  TimestampCell,
} from "../components/Common";
import { RelatedTicketsPanel } from "../components/RelatedTicketsPanel";
import { useAppContext } from "../context/AppContext";
import {
  extractProblemDetails,
  formatLocalTime,
  shortTypeName,
} from "../utils/format";

type TimePreset = "24h" | "7d" | "30d" | "custom";

interface UnifiedRenderEntry {
  kind: "message" | "log" | "ticketMarker";
  id: string;
  timestamp: string;
  message?: MessageSummary;
  nestedLogs?: LogEvent[];
  log?: LogEvent;
  ticketMarker?: RelatedTicket;
}

export const PolicyLookupPage: React.FC = () => {
  const { policyNumber = "OUTINT00118618" } = useParams<{
    policyNumber: string;
  }>();
  const navigate = useNavigate();
  const {
    config,
    endpoints,
    openMessageDrawer,
    openPivotLogs,
    refreshVersion,
  } = useAppContext();

  // Time Range state
  const [preset, setPreset] = useState<TimePreset>(() =>
    config.defaultLookbackDays === 1
      ? "24h"
      : config.defaultLookbackDays === 30
      ? "30d"
      : "7d"
  );
  const [customFrom, setCustomFrom] = useState("2026-09-25T00:00");
  const [customTo, setCustomTo] = useState("2026-10-02T14:00");
  const [includeNoise, setIncludeNoise] = useState(false);

  // Lookup state
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<
    typeof extractProblemDetails
  > | null>(null);

  // Independent Related Jira Tickets state
  const [ticketsData, setTicketsData] = useState<RelatedTicketsResult | null>(
    null
  );
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [showTicketsOnTimeline, setShowTicketsOnTimeline] = useState(false);

  // Mobile/Tablet Tab Switcher ("timeline" | "tickets")
  const [narrowViewTab, setNarrowViewTab] = useState<"timeline" | "tickets">(
    "timeline"
  );

  // Client-side Timeline Filters & Toggles
  const [sourceFilter, setSourceFilter] = useState<
    "both" | "messages" | "logs"
  >("both");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [endpointFilter, setEndpointFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [groupByConversation, setGroupByConversation] = useState(false);

  // Expanded states for nested logs under messages and inline expanded logs
  const [expandedMessageLogs, setExpandedMessageLogs] = useState<
    Record<string, boolean>
  >({});
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>(
    {}
  );

  const computeTimeWindow = useCallback(() => {
    const refNow = new Date("2026-10-02T13:30:00.000Z");
    if (preset === "custom") {
      return {
        from: new Date(customFrom).toISOString(),
        to: new Date(customTo).toISOString(),
      };
    }
    const days = preset === "24h" ? 1 : preset === "30d" ? 30 : 7;
    const fromDate = new Date(refNow.getTime() - days * 24 * 3600 * 1000);
    return {
      from: fromDate.toISOString(),
      to: refNow.toISOString(),
    };
  }, [preset, customFrom, customTo]);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = computeTimeWindow();
      const res = await lookupPolicy(policyNumber, {
        from,
        to,
        includeNoise,
      });
      setLookupData(res);
    } catch (e) {
      setError(extractProblemDetails(e));
    } finally {
      setLoading(false);
    }
  }, [policyNumber, computeTimeWindow, includeNoise]);

  const fetchJiraTickets = useCallback(async () => {
    if (!config.jira.enabled) return;
    setTicketsLoading(true);
    try {
      const { from, to } = computeTimeWindow();
      const res = await getRelatedTickets({
        policyNumber,
        from,
        to,
      });
      setTicketsData(res);
    } catch (e) {
      const prob = extractProblemDetails(e);
      setTicketsData({
        enabled: true,
        ok: false,
        error: prob.detail,
        tickets: [],
        truncated: false,
      });
    } finally {
      setTicketsLoading(false);
    }
  }, [policyNumber, computeTimeWindow, config.jira.enabled]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline, refreshVersion]);

  useEffect(() => {
    fetchJiraTickets();
  }, [fetchJiraTickets]);

  // Summary counts
  const summaryStats = useMemo(() => {
    const msgByStatus: Record<string, number> = {
      successful: 0,
      failed: 0,
      repeatedFailure: 0,
      retryIssued: 0,
      resolved: 0,
      archived: 0,
    };
    const logsByLevel: Record<string, number> = {
      Fatal: 0,
      Error: 0,
      Warning: 0,
      Information: 0,
      Debug: 0,
      Verbose: 0,
    };

    if (!lookupData) {
      return { msgByStatus, logsByLevel, totalMessages: 0, totalLogs: 0 };
    }

    let totalMessages = 0;
    let totalLogs = 0;

    for (const item of lookupData.items) {
      if (item.kind === "message" && item.message) {
        totalMessages++;
        msgByStatus[item.message.status] =
          (msgByStatus[item.message.status] || 0) + 1;
      } else if (item.kind === "log" && item.log) {
        totalLogs++;
        const lvl = item.log.level;
        logsByLevel[lvl] = (logsByLevel[lvl] || 0) + 1;
      }
    }

    return { msgByStatus, logsByLevel, totalMessages, totalLogs };
  }, [lookupData]);

  // Build unified timeline with logs matching a messageId nested under that message
  const unifiedEntries = useMemo<UnifiedRenderEntry[]>(() => {
    if (!lookupData) return [];

    const messageMap = new Map<string, MessageSummary>();
    const nestedLogsMap = new Map<string, LogEvent[]>();

    for (const item of lookupData.items) {
      if (item.kind === "message" && item.message) {
        messageMap.set(item.message.messageId, item.message);
        nestedLogsMap.set(item.message.messageId, []);
      }
    }

    const standaloneLogs: LogEvent[] = [];
    for (const item of lookupData.items) {
      if (item.kind === "log" && item.log) {
        const mId = item.log.messageId;
        // Nest under message if message is present and messages are shown
        if (mId && messageMap.has(mId) && sourceFilter !== "logs") {
          nestedLogsMap.get(mId)!.push(item.log);
        } else {
          standaloneLogs.push(item.log);
        }
      }
    }

    const entries: UnifiedRenderEntry[] = [];

    if (sourceFilter !== "logs") {
      for (const msg of messageMap.values()) {
        if (statusFilter !== "all" && msg.status !== statusFilter) continue;
        if (
          endpointFilter !== "all" &&
          msg.receivingEndpoint !== endpointFilter &&
          msg.sendingEndpoint !== endpointFilter
        ) {
          continue;
        }
        const nested = (nestedLogsMap.get(msg.messageId) || []).sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const msgMatches =
            msg.messageType.toLowerCase().includes(q) ||
            msg.messageId.toLowerCase().includes(q) ||
            (msg.exceptionMessage &&
              msg.exceptionMessage.toLowerCase().includes(q)) ||
            (msg.receivingEndpoint &&
              msg.receivingEndpoint.toLowerCase().includes(q));
          const nestedMatches = nested.some((l) =>
            l.renderedMessage.toLowerCase().includes(q)
          );
          if (!msgMatches && !nestedMatches) continue;
        }

        entries.push({
          kind: "message",
          id: msg.id,
          timestamp: msg.timeSent || msg.processedAt || "",
          message: msg,
          nestedLogs: nested,
        });
      }
    }

    if (sourceFilter !== "messages") {
      for (const log of standaloneLogs) {
        if (
          levelFilter !== "all" &&
          log.level.toLowerCase() !== levelFilter.toLowerCase()
        ) {
          continue;
        }
        if (endpointFilter !== "all") {
          const appLower = (log.application || "").toLowerCase();
          if (!appLower.includes(endpointFilter.replace(/-/g, ""))) {
            continue;
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            log.renderedMessage.toLowerCase().includes(q) ||
            (log.exception && log.exception.toLowerCase().includes(q)) ||
            (log.application && log.application.toLowerCase().includes(q));
          if (!matches) continue;
        }

        entries.push({
          kind: "log",
          id: log.id,
          timestamp: log.timestamp,
          log,
        });
      }
    }

    // Add Jira ticket resolved markers when "Show on timeline" is toggled on
    if (showTicketsOnTimeline && ticketsData?.ok) {
      for (const rel of ticketsData.tickets) {
        if (rel.ticket.resolved) {
          entries.push({
            kind: "ticketMarker",
            id: `marker-${rel.ticket.key}`,
            timestamp: rel.ticket.resolved,
            ticketMarker: rel,
          });
        }
      }
    }

    const dir = sortDirection === "asc" ? 1 : -1;
    entries.sort(
      (a, b) =>
        (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) *
        dir
    );

    return entries;
  }, [
    lookupData,
    sourceFilter,
    statusFilter,
    levelFilter,
    endpointFilter,
    searchQuery,
    sortDirection,
    showTicketsOnTimeline,
    ticketsData,
  ]);

  // Group-by-conversation cards when groupByConversation is active
  const conversationGroups = useMemo(() => {
    if (!lookupData) return [];
    const groups = new Map<
      string,
      {
        conversationId: string;
        messages: MessageSummary[];
        logs: LogEvent[];
        earliest: string;
        latest: string;
      }
    >();

    for (const cId of lookupData.conversationIds) {
      groups.set(cId, {
        conversationId: cId,
        messages: [],
        logs: [],
        earliest: "",
        latest: "",
      });
    }

    for (const item of lookupData.items) {
      const cId =
        item.kind === "message"
          ? item.message?.conversationId
          : item.log?.conversationId;
      const key = cId || "uncorrelated";
      if (!groups.has(key)) {
        groups.set(key, {
          conversationId: key,
          messages: [],
          logs: [],
          earliest: item.timestamp,
          latest: item.timestamp,
        });
      }
      const g = groups.get(key)!;
      if (item.kind === "message" && item.message) {
        g.messages.push(item.message);
      } else if (item.kind === "log" && item.log) {
        g.logs.push(item.log);
      }
      if (
        !g.earliest ||
        new Date(item.timestamp) < new Date(g.earliest)
      ) {
        g.earliest = item.timestamp;
      }
      if (!g.latest || new Date(item.timestamp) > new Date(g.latest)) {
        g.latest = item.timestamp;
      }
    }

    return Array.from(groups.values()).filter(
      (g) => g.messages.length > 0 || g.logs.length > 0
    );
  }, [lookupData]);

  const toggleNestedLogs = (msgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedMessageLogs((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const toggleLogExpand = (logId: string) => {
    setExpandedLogIds((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  const renderLogDetails = (log: LogEvent) => (
    <div
      data-testid={`log-expanded-${log.id}`}
      className="px-4 py-3 bg-surface-subtle border-t border-border-subtle space-y-3 text-xs"
    >
      {log.exception && (
        <div>
          <div className="text-[11px] font-semibold text-text-secondary mb-1">
            Exception
          </div>
          <pre
            className="p-2.5 rounded border font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed"
            style={{
              backgroundColor: "var(--status-failed-bg)",
              borderColor: "var(--status-failed-border)",
              color: "var(--status-failed-text)",
            }}
          >
            {log.exception}
          </pre>
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold text-text-secondary mb-1.5">
          Structured Properties
        </div>
        <div className="rounded border border-border-subtle bg-surface overflow-hidden">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <tbody className="divide-y divide-border-subtle">
              {Object.entries(log.properties).map(([k, v]) => (
                <tr key={k} className="hover:bg-surface-hover">
                  <td className="py-1.5 px-3 text-text-secondary w-1/3">
                    {k}
                  </td>
                  <td className="py-1.5 px-3 text-text-primary break-all">
                    {String(v)}
                  </td>
                  <td className="py-1.5 px-3 text-right w-16">
                    <CopyButton value={String(v)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {log.requestId && (
            <button
              type="button"
              data-testid={`pivot-request-${log.id}`}
              onClick={() => openPivotLogs({ requestId: log.requestId! })}
              className="text-xs font-medium text-brand-purple hover:underline cursor-pointer"
            >
              All logs for this request ({log.requestId})
            </button>
          )}
          {log.sessionId && (
            <button
              type="button"
              data-testid={`pivot-session-${log.id}`}
              onClick={() => openPivotLogs({ sessionId: log.sessionId! })}
              className="text-xs font-medium text-brand-purple hover:underline cursor-pointer"
            >
              All logs for this session ({log.sessionId})
            </button>
          )}
        </div>

        <a
          href={log.seqUrl}
          target="_blank"
          rel="noreferrer"
          data-testid={`open-in-seq-${log.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-purple hover:underline"
        >
          <span>Open in Seq</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );

  return (
    <div className="p-5 space-y-4 max-w-[1600px] mx-auto">
      {/* Header Row: Policy Title + Time Range Picker + Source Status Chips */}
      <div className="p-4 rounded-lg border border-border-subtle bg-surface flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1
              data-testid="policy-heading"
              className="text-lg font-bold font-mono text-text-primary tracking-tight"
            >
              {policyNumber.toUpperCase()}
            </h1>
            <CopyButton
              value={policyNumber.toUpperCase()}
              label="Copy policy"
            />
          </div>

          {/* Source Status Indicators */}
          {lookupData && (
            <div className="flex items-center gap-3 flex-wrap text-xs pt-1">
              <div
                data-testid="source-status-seq"
                className="inline-flex items-center gap-1.5 font-mono"
              >
                {lookupData.sources.seq.ok ? (
                  <CheckCircle2
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--status-success-text)" }}
                  />
                ) : (
                  <XCircle
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--status-failed-text)" }}
                  />
                )}
                <span className="font-semibold text-text-primary">Seq:</span>
                <span className="text-text-secondary">
                  {lookupData.sources.seq.ok ? "ok" : "error"}
                </span>
                <span className="text-text-muted tabular-nums">
                  ({lookupData.sources.seq.durationMs}ms)
                </span>
              </div>

              <span className="text-text-muted">·</span>

              <div
                data-testid="source-status-servicecontrol"
                className="inline-flex items-center gap-1.5 font-mono"
              >
                {lookupData.sources.serviceControl.ok ? (
                  <CheckCircle2
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--status-success-text)" }}
                  />
                ) : (
                  <XCircle
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--status-failed-text)" }}
                  />
                )}
                <span className="font-semibold text-text-primary">
                  ServiceControl:
                </span>
                <span className="text-text-secondary">
                  {lookupData.sources.serviceControl.ok ? "ok" : "error"}
                </span>
                <span className="text-text-muted tabular-nums">
                  ({lookupData.sources.serviceControl.durationMs}ms)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Time Range Picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary font-medium">
            Lookback:
          </span>
          <div className="flex items-center rounded border border-border-strong bg-surface-subtle p-0.5 text-xs">
            {(
              [
                { id: "24h", label: "24 hours" },
                { id: "7d", label: "7 days" },
                { id: "30d", label: "30 days" },
                { id: "custom", label: "Custom" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid={`time-preset-${p.id}`}
                onClick={() => setPreset(p.id)}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  preset === p.id
                    ? "bg-brand-purple text-text-on-purple"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <input
                type="datetime-local"
                data-testid="custom-range-from"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 rounded border border-border-strong bg-surface text-text-primary"
              />
              <span className="text-text-muted">to</span>
              <input
                type="datetime-local"
                data-testid="custom-range-to"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 rounded border border-border-strong bg-surface text-text-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Partial Source Error Banner (when Seq or ServiceControl failed) */}
      {lookupData &&
        (!lookupData.sources.seq.ok ||
          !lookupData.sources.serviceControl.ok) && (
          <div
            data-testid="source-error-banner"
            className="p-3.5 rounded-lg border flex items-start justify-between gap-4 text-xs"
            style={{
              backgroundColor: "var(--status-failed-bg)",
              borderColor: "var(--status-failed-border)",
              color: "var(--status-failed-text)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">
                  Partial Telemetry Source Failure — Rendering Remaining Data
                </div>
                {!lookupData.sources.seq.ok && (
                  <p className="font-mono">
                    Seq Error: {lookupData.sources.seq.error}
                  </p>
                )}
                {!lookupData.sources.serviceControl.ok && (
                  <p className="font-mono">
                    ServiceControl Error:{" "}
                    {lookupData.sources.serviceControl.error}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={fetchTimeline}
              className="px-3 py-1 rounded bg-surface text-text-primary border border-border-strong hover:bg-surface-hover font-medium shrink-0 cursor-pointer"
            >
              Retry Source
            </button>
          </div>
        )}

      {/* Truncation Notices */}
      {lookupData &&
        (lookupData.truncated.messages || lookupData.truncated.logs) && (
          <div
            data-testid="truncation-notice"
            className="p-3 rounded-lg border flex items-center justify-between gap-3 text-xs"
            style={{
              backgroundColor: "var(--status-retry-bg)",
              borderColor: "var(--status-retry-border)",
              color: "var(--status-retry-text)",
            }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Results truncated:</strong>{" "}
                {lookupData.truncated.messages &&
                  "ServiceControl message limit reached. "}
                {lookupData.truncated.logs && "Seq log event limit reached. "}
                Select a narrower time range (e.g. 24 hours or Custom) to inspect
                all events without omission.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPreset("24h")}
              className="px-2.5 py-1 rounded bg-surface text-text-primary border border-border-strong hover:bg-surface-hover font-medium shrink-0 cursor-pointer whitespace-nowrap"
            >
              Narrow to 24h
            </button>
          </div>
        )}

      {/* Summary Row: Counts of messages by status, count of logs by level, number of conversations */}
      {lookupData && (
        <div
          data-testid="policy-summary-row"
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="p-3.5 rounded-lg border border-border-subtle bg-surface">
            <div className="text-xs font-semibold text-text-secondary mb-2 flex items-center justify-between">
              <span>Messages by Status</span>
              <span className="font-mono text-text-primary tabular-nums">
                {summaryStats.totalMessages} total
              </span>
            </div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs font-mono tabular-nums">
              <span>
                <strong className="text-text-primary">
                  {summaryStats.msgByStatus.successful}
                </strong>{" "}
                <span className="text-text-secondary">successful</span>
              </span>
              <span className="text-text-muted">·</span>
              <span>
                <strong
                  style={{
                    color:
                      summaryStats.msgByStatus.failed +
                        summaryStats.msgByStatus.repeatedFailure >
                      0
                        ? "var(--status-failed-text)"
                        : undefined,
                  }}
                >
                  {summaryStats.msgByStatus.failed +
                    summaryStats.msgByStatus.repeatedFailure}
                </strong>{" "}
                <span className="text-text-secondary">failed</span>
              </span>
              <span className="text-text-muted">·</span>
              <span>
                <strong className="text-text-primary">
                  {summaryStats.msgByStatus.retryIssued}
                </strong>{" "}
                <span className="text-text-secondary">retryIssued</span>
              </span>
              <span className="text-text-muted">·</span>
              <span>
                <strong className="text-text-primary">
                  {summaryStats.msgByStatus.resolved}
                </strong>{" "}
                <span className="text-text-secondary">resolved</span>
              </span>
              <span className="text-text-muted">·</span>
              <span>
                <strong className="text-text-primary">
                  {summaryStats.msgByStatus.archived}
                </strong>{" "}
                <span className="text-text-secondary">archived</span>
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border-subtle bg-surface">
            <div className="text-xs font-semibold text-text-secondary mb-2 flex items-center justify-between">
              <span>Seq Logs by Level</span>
              <span className="font-mono text-text-primary tabular-nums">
                {summaryStats.totalLogs} events
              </span>
            </div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs font-mono tabular-nums">
              <span>
                <strong
                  style={{
                    color:
                      summaryStats.logsByLevel.Fatal > 0
                        ? "var(--status-failed-text)"
                        : undefined,
                  }}
                >
                  {summaryStats.logsByLevel.Fatal}
                </strong>{" "}
                <span className="text-text-secondary">Fatal</span>
              </span>
              <span className="text-text-muted">·</span>
              <span>
                <strong
                  style={{
                    color:
                      summaryStats.logsByLevel.Error > 0
                        ? "var(--status-failed-text)"
                        : undefined,
                  }}
                >
                  {summaryStats.logsByLevel.Error}
                </strong>{" "}
                <span className="text-text-secondary">Error</span>
              </span>
              <span className="text-text-muted">·</span>
              <span>
                <strong className="text-text-primary">
                  {summaryStats.logsByLevel.Warning}
                </strong>{" "}
                <span className="text-text-secondary">Warning</span>
              </span>
              <span className="text-text-muted">·</span>
              <span>
                <strong className="text-text-primary">
                  {summaryStats.logsByLevel.Information}
                </strong>{" "}
                <span className="text-text-secondary">Info</span>
              </span>
              {(summaryStats.logsByLevel.Debug > 0 ||
                summaryStats.logsByLevel.Verbose > 0) && (
                <>
                  <span className="text-text-muted">·</span>
                  <span>
                    <strong className="text-text-primary">
                      {summaryStats.logsByLevel.Debug +
                        summaryStats.logsByLevel.Verbose}
                    </strong>{" "}
                    <span className="text-text-secondary">Debug/Verbose</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border-subtle bg-surface">
            <div className="text-xs font-semibold text-text-secondary mb-2 flex items-center justify-between">
              <span>NServiceBus Conversations</span>
              <span className="font-mono text-text-primary tabular-nums">
                {lookupData.conversationIds.length} active
              </span>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              {lookupData.conversationIds.length === 0 ? (
                <span className="text-xs text-text-muted">
                  No conversations recorded
                </span>
              ) : (
                lookupData.conversationIds.map((cId) => (
                  <button
                    key={cId}
                    type="button"
                    data-testid={`summary-conv-link-${cId}`}
                    onClick={() => navigate(`/conversations/${cId}`)}
                    className="inline-flex items-center gap-1 font-mono text-xs text-brand-purple hover:underline cursor-pointer"
                  >
                    <GitBranch className="w-3 h-3" />
                    <span>{cId}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Narrow Screen Tab Toggle between Timeline and Related Tickets */}
      {config.jira.enabled && (
        <div className="flex xl:hidden items-center gap-1 p-1 rounded-lg border border-border-subtle bg-surface">
          <button
            type="button"
            onClick={() => setNarrowViewTab("timeline")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${
              narrowViewTab === "timeline"
                ? "bg-brand-purple text-text-on-purple"
                : "text-text-secondary"
            }`}
          >
            Unified Timeline ({unifiedEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setNarrowViewTab("tickets")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${
              narrowViewTab === "tickets"
                ? "bg-brand-purple text-text-on-purple"
                : "text-text-secondary"
            }`}
          >
            Related Jira Tickets (
            {ticketsData?.ok ? ticketsData.tickets.length : "!"})
          </button>
        </div>
      )}

      {/* Main Split Grid: Unified Timeline (Left) + Related Tickets Panel (Right on wide screens) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 8 cols: Timeline & Controls */}
        <div
          className={`${
            config.jira.enabled ? "xl:col-span-8" : "xl:col-span-12"
          } space-y-3 ${
            narrowViewTab === "tickets" ? "hidden xl:block" : "block"
          }`}
        >
          {/* Filter & Toggles Bar */}
          <div className="p-3 rounded-lg border border-border-subtle bg-surface space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Source Segmented Filter */}
              <div className="flex items-center gap-1 p-0.5 rounded border border-border-strong bg-surface-subtle text-xs">
                {(["both", "messages", "logs"] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    data-testid={`timeline-source-${src}`}
                    onClick={() => setSourceFilter(src)}
                    className={`px-2.5 py-1 rounded font-medium capitalize cursor-pointer transition-colors ${
                      sourceFilter === src
                        ? "bg-brand-purple text-text-on-purple"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>

              {/* Status Dropdown */}
              <select
                data-testid="timeline-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by message status"
                className="px-2.5 py-1.5 text-xs rounded border border-border-strong bg-surface text-text-primary"
              >
                <option value="all">All message statuses</option>
                <option value="failed">Failed</option>
                <option value="repeatedFailure">Repeated failure</option>
                <option value="retryIssued">Retry issued</option>
                <option value="successful">Successful</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>

              {/* Log Level Dropdown */}
              <select
                data-testid="timeline-level-filter"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                aria-label="Filter by log level"
                className="px-2.5 py-1.5 text-xs rounded border border-border-strong bg-surface text-text-primary"
              >
                <option value="all">All log levels</option>
                <option value="Fatal">Fatal</option>
                <option value="Error">Error</option>
                <option value="Warning">Warning</option>
                <option value="Information">Information</option>
                <option value="Debug">Debug</option>
                <option value="Verbose">Verbose</option>
              </select>

              {/* Endpoint Dropdown */}
              <select
                data-testid="timeline-endpoint-filter"
                value={endpointFilter}
                onChange={(e) => setEndpointFilter(e.target.value)}
                aria-label="Filter by endpoint"
                className="px-2.5 py-1.5 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary"
              >
                <option value="all">All endpoints</option>
                {endpoints.map((ep) => (
                  <option key={ep} value={ep}>
                    {ep}
                  </option>
                ))}
              </select>

              {/* Free-text search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  data-testid="timeline-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter timeline text, type, ID..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-purple"
                />
              </div>

              {/* Sort Asc/Desc Toggle */}
              <button
                type="button"
                data-testid="timeline-sort-direction"
                onClick={() =>
                  setSortDirection((d) => (d === "desc" ? "asc" : "desc"))
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary cursor-pointer whitespace-nowrap"
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-brand-purple" />
                <span>
                  {sortDirection === "desc" ? "Newest first" : "Oldest first"}
                </span>
              </button>
            </div>

            {/* Second Bar: Framework noise toggle + Group by conversation toggle */}
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <label
                  data-testid="toggle-framework-noise"
                  className="inline-flex items-center gap-2 cursor-pointer select-none text-text-secondary"
                >
                  <input
                    type="checkbox"
                    checked={includeNoise}
                    onChange={(e) => setIncludeNoise(e.target.checked)}
                    className="rounded border-border-strong text-brand-purple focus:ring-brand-purple cursor-pointer"
                  />
                  <span className="font-medium text-text-primary">
                    Show framework noise
                  </span>
                  {!includeNoise &&
                    lookupData &&
                    lookupData.hiddenNoiseCount > 0 && (
                      <span
                        data-testid="hidden-noise-count"
                        className="font-mono text-[11px] text-text-muted tabular-nums"
                      >
                        ({lookupData.hiddenNoiseCount} events hidden)
                      </span>
                    )}
                </label>

                <label
                  data-testid="toggle-group-by-conversation"
                  className="inline-flex items-center gap-2 cursor-pointer select-none text-text-secondary"
                >
                  <input
                    type="checkbox"
                    checked={groupByConversation}
                    onChange={(e) => setGroupByConversation(e.target.checked)}
                    className="rounded border-border-strong text-brand-purple focus:ring-brand-purple cursor-pointer"
                  />
                  <Layers className="w-3.5 h-3.5 text-brand-purple" />
                  <span className="font-medium text-text-primary">
                    Group by conversation
                  </span>
                </label>
              </div>

              <div className="font-mono text-[11px] text-text-muted tabular-nums">
                Showing {unifiedEntries.length} top-level entries
              </div>
            </div>
          </div>

          {/* Timeline Content */}
          {loading ? (
            <SkeletonRows count={10} height="h-12" />
          ) : error ? (
            <ErrorState problem={error} onRetry={fetchTimeline} />
          ) : !lookupData || lookupData.items.length === 0 ? (
            <EmptyState
              title="No telemetry events found"
              description={`No Seq logs or ServiceControl messages were recorded for policy ${policyNumber} in the selected lookback window.`}
            />
          ) : groupByConversation ? (
            /* Group-by-Conversation View */
            <div
              data-testid="grouped-conversations-list"
              className="space-y-3"
            >
              {conversationGroups.map((grp) => {
                const failedCount = grp.messages.filter(
                  (m) =>
                    m.status === "failed" || m.status === "repeatedFailure"
                ).length;
                return (
                  <div
                    key={grp.conversationId}
                    data-testid={`conversation-card-${grp.conversationId}`}
                    className="p-4 rounded-lg border border-border-subtle bg-surface space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <GitBranch className="w-4 h-4 text-brand-purple" />
                        <span className="font-mono text-xs font-semibold text-text-primary">
                          {grp.conversationId}
                        </span>
                        <CopyButton value={grp.conversationId} />
                        <span className="text-xs text-text-muted">·</span>
                        <span className="text-xs font-mono text-text-secondary tabular-nums">
                          {grp.messages.length} messages · {grp.logs.length}{" "}
                          logs
                        </span>
                        {failedCount > 0 && (
                          <span
                            className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded"
                            style={{
                              backgroundColor: "var(--status-failed-bg)",
                              color: "var(--status-failed-text)",
                            }}
                          >
                            {failedCount} failed
                          </span>
                        )}
                      </div>

                      {grp.conversationId !== "uncorrelated" && (
                        <button
                          type="button"
                          data-testid={`open-flow-diagram-${grp.conversationId}`}
                          onClick={() =>
                            navigate(`/conversations/${grp.conversationId}`)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-brand-purple hover:bg-brand-purple-dark text-text-on-purple cursor-pointer whitespace-nowrap"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          <span>Open flow diagram</span>
                        </button>
                      )}
                    </div>

                    {/* Messages inside this conversation */}
                    <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
                      {grp.messages.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => openMessageDrawer(m.id)}
                          className="px-3.5 py-2.5 bg-surface hover:bg-surface-hover flex items-center justify-between gap-3 text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <StatusBadge status={m.status} />
                            <span
                              title={m.messageType}
                              className="font-mono font-semibold text-text-primary truncate"
                            >
                              {shortTypeName(m.messageType)}
                            </span>
                            <span className="font-mono text-[11px] text-text-secondary hidden sm:inline">
                              {m.sendingEndpoint} → {m.receivingEndpoint}
                            </span>
                          </div>
                          <TimestampCell iso={m.timeSent} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : unifiedEntries.length === 0 ? (
            <EmptyState
              title="No matching timeline items"
              description="Adjust your source, status, level, or text search filters to view timeline events."
            />
          ) : (
            /* Chronological Unified Timeline */
            <div
              data-testid="unified-timeline-list"
              className="rounded-lg border border-border-subtle bg-surface divide-y divide-border-subtle overflow-hidden"
            >
              {unifiedEntries.map((entry) => {
                if (entry.kind === "ticketMarker" && entry.ticketMarker) {
                  const t = entry.ticketMarker.ticket;
                  return (
                    <div
                      key={entry.id}
                      data-testid={`timeline-ticket-marker-${t.key}`}
                      style={{
                        backgroundColor: "var(--surface-subtle)",
                        borderLeft: "4px solid var(--brand-lime)",
                      }}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TimestampCell
                          iso={entry.timestamp}
                          showRelative={false}
                        />
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold shrink-0"
                          style={{
                            backgroundColor: "var(--brand-lime)",
                            color: "var(--text-on-lime)",
                          }}
                        >
                          <GitCommit className="w-3 h-3" />
                          <span>Jira Resolved: {t.key}</span>
                        </span>
                        <span className="font-medium text-text-primary truncate">
                          {t.summary}
                        </span>
                      </div>
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-mono text-brand-purple hover:underline shrink-0"
                      >
                        <span>View Ticket</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                }

                if (entry.kind === "message" && entry.message) {
                  const msg = entry.message;
                  const nested = entry.nestedLogs || [];
                  const isNestedOpen = Boolean(
                    expandedMessageLogs[msg.messageId]
                  );

                  return (
                    <div
                      key={entry.id}
                      className="bg-surface"
                    >
                      <div
                        data-testid={`timeline-row-${msg.id}`}
                        onClick={() => openMessageDrawer(msg.id)}
                        className="px-3.5 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <TimestampCell
                            iso={entry.timestamp}
                            showRelative={false}
                          />

                          {/* Source Icon: ServiceControl */}
                          <span
                            title="NServiceBus Message (ServiceControl)"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle font-mono text-[10px] text-text-secondary shrink-0"
                          >
                            <MessageSquare className="w-3 h-3 text-brand-purple" />
                            <span>NSB</span>
                          </span>

                          <StatusBadge status={msg.status} />

                          <span
                            title={msg.messageType}
                            className="font-mono font-semibold text-text-primary truncate"
                          >
                            {shortTypeName(msg.messageType)}
                          </span>

                          <span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-text-secondary shrink-0">
                            <span>{msg.sendingEndpoint || "—"}</span>
                            <ArrowRight className="w-3 h-3 text-text-muted" />
                            <span>{msg.receivingEndpoint || "—"}</span>
                          </span>

                          {msg.sagaIds.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/sagas/${msg.sagaIds[0]}`);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer shrink-0"
                              style={{
                                backgroundColor: "var(--brand-lime)",
                                color: "var(--text-on-lime)",
                              }}
                            >
                              <Workflow className="w-3 h-3" />
                              <span>Saga</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {nested.length > 0 && (
                            <button
                              type="button"
                              data-testid={`toggle-nested-logs-${msg.id}`}
                              onClick={(e) =>
                                toggleNestedLogs(msg.messageId, e)
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border-strong bg-surface-subtle hover:bg-surface-hover font-mono text-[11px] text-text-primary cursor-pointer"
                            >
                              {isNestedOpen ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              <span>
                                {nested.length} log
                                {nested.length === 1 ? "" : "s"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Nested Correlated Logs under this Message */}
                      {isNestedOpen && nested.length > 0 && (
                        <div
                          data-testid={`nested-logs-container-${msg.id}`}
                          className="pl-8 pr-3 py-2 bg-surface-subtle border-t border-border-subtle space-y-1.5"
                        >
                          {nested.map((nLog) => {
                            const isLogExp = Boolean(expandedLogIds[nLog.id]);
                            return (
                              <div
                                key={nLog.id}
                                className="rounded border border-border-subtle bg-surface overflow-hidden"
                              >
                                <div
                                  onClick={() => toggleLogExpand(nLog.id)}
                                  className="px-3 py-2 hover:bg-surface-hover cursor-pointer flex items-start gap-2.5 text-xs"
                                >
                                  <span className="font-mono text-[11px] text-text-muted whitespace-nowrap tabular-nums">
                                    {formatLocalTime(nLog.timestamp)}
                                  </span>
                                  <LogLevelBadge level={nLog.level} />
                                  <span className="font-mono text-text-primary flex-1 break-words">
                                    {nLog.renderedMessage}
                                  </span>
                                  <span className="font-mono text-[11px] text-text-muted whitespace-nowrap">
                                    {nLog.application}
                                  </span>
                                </div>
                                {isLogExp && renderLogDetails(nLog)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                if (entry.kind === "log" && entry.log) {
                  const log = entry.log;
                  const isExp = Boolean(expandedLogIds[log.id]);
                  return (
                    <div
                      key={entry.id}
                      data-testid={`timeline-row-${log.id}`}
                      className="bg-surface"
                    >
                      <div
                        onClick={() => toggleLogExpand(log.id)}
                        className="px-3.5 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <TimestampCell
                            iso={entry.timestamp}
                            showRelative={false}
                          />

                          {/* Source Icon: Seq */}
                          <span
                            title="Seq Log Event"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle font-mono text-[10px] text-text-secondary shrink-0"
                          >
                            <Terminal className="w-3 h-3 text-text-secondary" />
                            <span>Seq</span>
                          </span>

                          <LogLevelBadge level={log.level} />

                          <span className="font-mono text-text-primary flex-1 break-words">
                            {log.renderedMessage}
                          </span>
                        </div>

                        {log.application && (
                          <span className="font-mono text-[11px] text-text-muted shrink-0 hidden sm:inline">
                            {log.application}
                          </span>
                        )}
                      </div>
                      {isExp && renderLogDetails(log)}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>

        {/* Right 4 cols: Related Tickets Panel */}
        {config.jira.enabled && (
          <div
            className={`xl:col-span-4 ${
              narrowViewTab === "tickets" ? "block" : "hidden xl:block"
            }`}
          >
            <RelatedTicketsPanel
              result={ticketsData}
              loading={ticketsLoading}
              onRetry={fetchJiraTickets}
              showOnTimeline={showTicketsOnTimeline}
              onToggleShowOnTimeline={setShowTicketsOnTimeline}
              highlightTerms={[policyNumber.toUpperCase()]}
            />
          </div>
        )}
      </div>
    </div>
  );
};
