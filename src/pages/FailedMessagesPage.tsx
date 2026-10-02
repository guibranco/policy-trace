import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { getMessages } from "../api/client";
import { MessageStatus, MessageSummary } from "../api/types";
import {
  CopyButton,
  EmptyState,
  ErrorState,
  SkeletonRows,
  StatusBadge,
  TimestampCell,
} from "../components/Common";
import { useAppContext } from "../context/AppContext";
import { extractProblemDetails, shortTypeName } from "../utils/format";

type FailedTab = "unresolved" | "retryIssued" | "archived";
type GroupBy = "none" | "endpoint" | "exceptionType";

export const FailedMessagesPage: React.FC = () => {
  const { openMessageDrawer, triggerAction, refreshVersion } = useAppContext();

  const [activeTab, setActiveTab] = useState<FailedTab>("unresolved");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof extractProblemDetails> | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const targetStatuses: MessageStatus[] = useMemo(() => {
    if (activeTab === "unresolved") return ["failed", "repeatedFailure"];
    if (activeTab === "retryIssued") return ["retryIssued"];
    return ["archived"];
  }, [activeTab]);

  const fetchFailedMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMessages({
        status: targetStatuses,
        pageSize: 100,
        sort: "timeSent",
        direction: "desc",
      });
      setMessages(res.items);
    } catch (e) {
      setError(extractProblemDetails(e));
    } finally {
      setLoading(false);
    }
  }, [targetStatuses]);

  useEffect(() => {
    setSelectedIds(new Set());
    fetchFailedMessages();
  }, [fetchFailedMessages, refreshVersion]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.messageType.toLowerCase().includes(q) ||
        m.messageId.toLowerCase().includes(q) ||
        (m.exceptionType && m.exceptionType.toLowerCase().includes(q)) ||
        (m.exceptionMessage && m.exceptionMessage.toLowerCase().includes(q)) ||
        (m.receivingEndpoint && m.receivingEndpoint.toLowerCase().includes(q))
    );
  }, [messages, searchQuery]);

  // Grouped data structure when groupBy is active
  const groupedData = useMemo(() => {
    if (groupBy === "none") return [];
    const groups = new Map<string, MessageSummary[]>();

    for (const m of filteredMessages) {
      const key =
        groupBy === "endpoint"
          ? m.receivingEndpoint || "unassigned"
          : m.exceptionType
          ? shortTypeName(m.exceptionType)
          : "No Exception Type";

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }

    return Array.from(groups.entries()).map(([name, items]) => ({
      name,
      items,
    }));
  }, [filteredMessages, groupBy]);

  const handleSelectGroup = (items: MessageSummary[]) => {
    const allSelected = items.every((item) => selectedIds.has(item.id));
    const next = new Set(selectedIds);
    if (allSelected) {
      items.forEach((item) => next.delete(item.id));
    } else {
      items.forEach((item) => next.add(item.id));
    }
    setSelectedIds(next);
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleToggleGroupExpand = (name: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const selectedMessages = messages.filter((m) => selectedIds.has(m.id));

  return (
    <div className="p-5 space-y-4 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="p-4 rounded-lg border border-border-subtle bg-surface space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-text-primary tracking-tight">
              Failed Messages Control
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Review exceptions, inspect stack traces, and bulk retry or archive failed messages
            </p>
          </div>

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div
              data-testid="failed-bulk-bar"
              className="flex items-center gap-2 p-1 px-3 rounded-lg border border-brand-purple bg-surface-subtle text-xs"
            >
              <span className="font-semibold text-text-primary tabular-nums">
                {selectedIds.size} selected
              </span>
              <span className="text-text-muted">·</span>
              <button
                type="button"
                data-testid="bulk-retry-failed-button"
                onClick={() => triggerAction("retry", selectedMessages)}
                className="px-2.5 py-1 rounded bg-brand-purple text-text-on-purple hover:bg-brand-purple-dark font-medium cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry ({selectedIds.size})</span>
              </button>
              {activeTab !== "archived" ? (
                <button
                  type="button"
                  data-testid="bulk-archive-failed-button"
                  onClick={() => triggerAction("archive", selectedMessages)}
                  className="px-2.5 py-1 rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary font-medium cursor-pointer inline-flex items-center gap-1"
                >
                  <Archive className="w-3 h-3" />
                  <span>Archive ({selectedIds.size})</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="bulk-unarchive-failed-button"
                  onClick={() => triggerAction("unarchive", selectedMessages)}
                  className="px-2.5 py-1 rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary font-medium cursor-pointer"
                >
                  <span>Unarchive ({selectedIds.size})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-text-muted hover:text-text-primary ml-1 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Tab switcher: Unresolved / Retry issued / Archived */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-t border-border-subtle pt-3">
          <div className="flex items-center gap-1 p-0.5 rounded border border-border-strong bg-surface-subtle text-xs">
            {(
              [
                { id: "unresolved", label: "Unresolved" },
                { id: "retryIssued", label: "Retry issued" },
                { id: "archived", label: "Archived" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid={`failed-tab-${t.id}`}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded font-medium cursor-pointer transition-colors ${
                  activeTab === t.id
                    ? "bg-brand-purple text-text-on-purple font-semibold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Grouping dropdown & search filter */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-secondary">Group by:</span>
              <select
                data-testid="group-by-select"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                aria-label="Group failed messages by"
                className="px-2.5 py-1.5 text-xs rounded border border-border-strong bg-surface text-text-primary"
              >
                <option value="none">No grouping (flat list)</option>
                <option value="endpoint">Receiving endpoint</option>
                <option value="exceptionType">Exception type</option>
              </select>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                data-testid="failed-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search type, exception, endpoint..."
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-purple"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table or Grouped View */}
      {loading ? (
        <SkeletonRows count={8} height="h-12" />
      ) : error ? (
        <ErrorState problem={error} onRetry={fetchFailedMessages} />
      ) : filteredMessages.length === 0 ? (
        <EmptyState
          title={`No ${activeTab} messages`}
          description={`There are currently no messages in status ${targetStatuses.join(", ")}.`}
        />
      ) : groupBy === "none" ? (
        /* Flat Table View */
        <div className="rounded-lg border border-border-subtle bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-subtle border-b border-border-subtle text-text-secondary">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      data-testid="select-all-failed-checkbox"
                      aria-label="Select all messages"
                      checked={
                        filteredMessages.length > 0 &&
                        filteredMessages.every((m) => selectedIds.has(m.id))
                      }
                      onChange={() => handleSelectGroup(filteredMessages)}
                      className="rounded border-border-strong text-brand-purple focus:ring-brand-purple cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-semibold w-28">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Message Type</th>
                  <th className="py-2.5 px-3 font-semibold">Receiving Endpoint</th>
                  <th className="py-2.5 px-3 font-semibold">Exception Type</th>
                  <th className="py-2.5 px-3 font-semibold">Exception Detail</th>
                  <th className="py-2.5 px-3 font-semibold">Time Sent</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-16">Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredMessages.map((m) => {
                  const isSelected = selectedIds.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      data-testid={`failed-row-${m.id}`}
                      onClick={() => openMessageDrawer(m.id)}
                      className={`hover:bg-surface-hover cursor-pointer transition-colors ${
                        isSelected ? "bg-surface-subtle" : ""
                      }`}
                    >
                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          data-testid={`failed-checkbox-${m.id}`}
                          aria-label={`Select message ${m.id}`}
                          checked={isSelected}
                          onChange={() => handleToggleRow(m.id)}
                          className="rounded border-border-strong text-brand-purple focus:ring-brand-purple cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <StatusBadge status={m.status} />
                      </td>

                      <td className="py-2.5 px-3 font-mono font-medium text-text-primary">
                        <span title={m.messageType} className="hover:underline">
                          {shortTypeName(m.messageType)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-text-secondary text-[11px]">
                        {m.receivingEndpoint || "—"}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-text-primary">
                        <span title={m.exceptionType || ""}>
                          {shortTypeName(m.exceptionType)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-text-secondary max-w-md truncate">
                        {m.exceptionMessage || "—"}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <TimestampCell iso={m.timeSent} />
                      </td>

                      <td className="py-2.5 px-3 font-mono text-center tabular-nums font-semibold text-text-primary">
                        {m.numberOfProcessingAttempts ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grouped View: group by endpoint or exceptionType */
        <div data-testid="failed-grouped-view" className="space-y-4">
          {groupedData.map((grp) => {
            const isGroupOpen = expandedGroups[grp.name] !== false; // default open
            const allGrpSelected = grp.items.every((item) =>
              selectedIds.has(item.id)
            );

            return (
              <div
                key={grp.name}
                data-testid={`group-card-${grp.name}`}
                className="rounded-lg border border-border-subtle bg-surface overflow-hidden shadow-xs"
              >
                {/* Group Header */}
                <div
                  onClick={() => handleToggleGroupExpand(grp.name)}
                  className="px-4 py-3 bg-surface-subtle border-b border-border-subtle flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-2.5">
                    {isGroupOpen ? (
                      <ChevronDown className="w-4 h-4 text-text-secondary" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text-secondary" />
                    )}
                    <span className="font-mono text-xs font-bold text-text-primary">
                      {grp.name}
                    </span>
                    <span className="font-mono text-xs text-text-muted tabular-nums">
                      ({grp.items.length} message{grp.items.length === 1 ? "" : "s"})
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      data-testid={`select-group-${grp.name}`}
                      onClick={() => handleSelectGroup(grp.items)}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary cursor-pointer"
                    >
                      {allGrpSelected ? "Deselect group" : "Select all in group"}
                    </button>
                  </div>
                </div>

                {/* Group Rows Table */}
                {isGroupOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <tbody className="divide-y divide-border-subtle">
                        {grp.items.map((m) => {
                          const isSelected = selectedIds.has(m.id);
                          return (
                            <tr
                              key={m.id}
                              data-testid={`failed-grouped-row-${m.id}`}
                              onClick={() => openMessageDrawer(m.id)}
                              className={`hover:bg-surface-hover cursor-pointer transition-colors ${
                                isSelected ? "bg-surface-subtle" : ""
                              }`}
                            >
                              <td
                                className="py-2 px-3 w-10 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleRow(m.id)}
                                  className="rounded border-border-strong text-brand-purple focus:ring-brand-purple cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap w-28">
                                <StatusBadge status={m.status} />
                              </td>
                              <td className="py-2 px-3 font-mono font-medium text-text-primary">
                                {shortTypeName(m.messageType)}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-text-secondary">
                                {m.receivingEndpoint || "—"}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-text-secondary max-w-sm truncate">
                                {m.exceptionMessage || "—"}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-right">
                                <TimestampCell iso={m.timeSent} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
