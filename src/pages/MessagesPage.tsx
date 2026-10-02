import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  RefreshCw,
  Search,
} from "lucide-react";
import { getMessages } from "../api/client";
import { type MessageStatus, type MessageSummary, type Paged } from "../api/types";
import {
  EmptyState,
  ErrorState,
  SkeletonRows,
  StatusBadge,
  TimestampCell,
} from "../components/Common";
import { useAppContext } from "../context/AppContext";
import { extractProblemDetails, shortTypeName } from "../utils/format";

const ALL_STATUSES: MessageStatus[] = [
  "successful",
  "failed",
  "repeatedFailure",
  "retryIssued",
  "resolved",
  "archived",
];

export const MessagesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    endpoints,
    openMessageDrawer,
    triggerAction,
    refreshVersion,
  } = useAppContext();

  // Read URL query params
  const endpoint = searchParams.get("endpoint") || "";
  const rawStatus = searchParams.get("status") || "";
  const selectedStatuses = rawStatus
    ? rawStatus.split(",").filter((s) => ALL_STATUSES.includes(s as MessageStatus))
    : [];
  const q = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1", 10) || 1;
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10) || 20;
  const sort = searchParams.get("sort") || "timeSent";
  const direction = searchParams.get("direction") || "desc";

  // Data state
  const [pagedData, setPagedData] = useState<Paged<MessageSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof extractProblemDetails> | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Local search draft
  const [searchDraft, setSearchDraft] = useState(q);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const updateParam = useCallback(
    (key: string, val: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (val === null || val === "" || val === "all") {
        next.delete(key);
      } else {
        next.set(key, val);
      }
      if (key !== "page") {
        next.set("page", "1");
      }
      setSearchParams(next);
      setSelectedIds(new Set());
    },
    [searchParams, setSearchParams]
  );

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMessages({
        endpoint: endpoint || undefined,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        q: q || undefined,
        page,
        pageSize,
        sort,
        direction,
      });
      setPagedData(res);
    } catch (e) {
      setError(extractProblemDetails(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint, rawStatus, q, page, pageSize, sort, direction]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages, refreshVersion]);

  const toggleStatus = (st: MessageStatus) => {
    let next: string[];
    if (selectedStatuses.includes(st)) {
      next = selectedStatuses.filter((s) => s !== st);
    } else {
      next = [...selectedStatuses, st];
    }
    updateParam("status", next.length > 0 ? next.join(",") : null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("q", searchDraft.trim() || null);
  };

  const handleToggleSelectAll = (actionableItems: MessageSummary[]) => {
    const allSelected = actionableItems.every((item) => selectedIds.has(item.id));
    const next = new Set(selectedIds);
    if (allSelected) {
      actionableItems.forEach((item) => next.delete(item.id));
    } else {
      actionableItems.forEach((item) => next.add(item.id));
    }
    setSelectedIds(next);
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const isActionable = (m: MessageSummary) => {
    return (
      m.status === "failed" ||
      m.status === "repeatedFailure" ||
      m.status === "archived"
    );
  };

  const actionableItems = pagedData?.items.filter(isActionable) || [];
  const selectedActionableItems =
    pagedData?.items.filter((m) => selectedIds.has(m.id)) || [];

  const totalPages = pagedData ? Math.max(1, Math.ceil(pagedData.totalCount / pageSize)) : 1;

  return (
    <div className="p-5 space-y-4 max-w-[1600px] mx-auto">
      {/* Top Header & Filters Bar */}
      <div className="p-4 rounded-lg border border-border-subtle bg-surface space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-text-primary tracking-tight">
              Messages Explorer
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Server-side paged view of all NServiceBus messages across endpoints
            </p>
          </div>

          {/* Bulk actions bar if items are selected */}
          {selectedIds.size > 0 && (
            <div
              data-testid="messages-bulk-bar"
              className="flex items-center gap-2 p-1 px-3 rounded-lg border border-brand-purple bg-surface-subtle text-xs"
            >
              <span className="font-semibold text-text-primary tabular-nums">
                {selectedIds.size} selected
              </span>
              <span className="text-text-muted">·</span>
              <button
                type="button"
                data-testid="bulk-retry-button"
                onClick={() =>
                  triggerAction("retry", selectedActionableItems)
                }
                className="px-2.5 py-1 rounded bg-brand-purple text-text-on-purple hover:bg-brand-purple-dark font-medium cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                data-testid="bulk-archive-button"
                onClick={() =>
                  triggerAction("archive", selectedActionableItems)
                }
                className="px-2.5 py-1 rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary font-medium cursor-pointer inline-flex items-center gap-1"
              >
                <Archive className="w-3 h-3" />
                <span>Archive</span>
              </button>
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

        {/* Filter Controls Row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Endpoint Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-text-secondary">Endpoint:</span>
            <select
              data-testid="messages-endpoint-filter"
              value={endpoint}
              onChange={(e) => updateParam("endpoint", e.target.value)}
              aria-label="Filter by endpoint"
              className="px-2.5 py-1.5 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary"
            >
              <option value="">All endpoints</option>
              {endpoints.map((ep) => (
                <option key={ep} value={ep}>
                  {ep}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-sm relative"
          >
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              data-testid="messages-search-input"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search type, ID, exception, conversation..."
              className="w-full pl-8 pr-16 py-1.5 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
            <button
              type="submit"
              data-testid="messages-search-button"
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-medium text-brand-purple hover:underline cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Sort Control */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-text-secondary">Sort:</span>
            <select
              data-testid="messages-sort-select"
              value={sort}
              onChange={(e) => updateParam("sort", e.target.value)}
              aria-label="Sort by field"
              className="px-2 py-1.5 text-xs rounded border border-border-strong bg-surface text-text-primary"
            >
              <option value="timeSent">Time Sent</option>
              <option value="processedAt">Processed Time</option>
            </select>
            <button
              type="button"
              data-testid="messages-direction-toggle"
              onClick={() =>
                updateParam("direction", direction === "desc" ? "asc" : "desc")
              }
              className="p-1.5 rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary cursor-pointer"
              title={direction === "desc" ? "Newest first" : "Oldest first"}
            >
              <ArrowDownUp className="w-3.5 h-3.5 text-brand-purple" />
            </button>
          </div>
        </div>

        {/* Status Multi-Select Toggle Bar */}
        <div className="pt-2 border-t border-border-subtle flex items-center gap-2 flex-wrap text-xs">
          <span className="font-medium text-text-secondary">Status filter:</span>
          {ALL_STATUSES.map((st) => {
            const isSelected = selectedStatuses.includes(st);
            return (
              <button
                key={st}
                type="button"
                data-testid={`status-filter-${st}`}
                onClick={() => toggleStatus(st)}
                className={`px-2.5 py-0.5 rounded font-mono text-xs cursor-pointer border transition-colors ${
                  isSelected
                    ? "bg-brand-purple text-text-on-purple border-brand-purple font-semibold"
                    : "bg-surface text-text-secondary border-border-strong hover:bg-surface-hover"
                }`}
              >
                {st}
              </button>
            );
          })}
          {selectedStatuses.length > 0 && (
            <button
              type="button"
              onClick={() => updateParam("status", null)}
              className="text-text-muted hover:text-text-primary text-[11px] underline ml-1 cursor-pointer"
            >
              Reset status
            </button>
          )}
        </div>
      </div>

      {/* Messages Data Table */}
      {loading ? (
        <SkeletonRows count={8} height="h-12" />
      ) : error ? (
        <ErrorState problem={error} onRetry={fetchMessages} />
      ) : !pagedData || pagedData.items.length === 0 ? (
        <EmptyState
          title="No messages found"
          description="No NServiceBus messages matched your active filter criteria."
        />
      ) : (
        <div className="rounded-lg border border-border-subtle bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-subtle border-b border-border-subtle text-text-secondary">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      data-testid="select-all-checkbox"
                      aria-label="Select all actionable messages on this page"
                      checked={
                        actionableItems.length > 0 &&
                        actionableItems.every((item) => selectedIds.has(item.id))
                      }
                      onChange={() => handleToggleSelectAll(actionableItems)}
                      disabled={actionableItems.length === 0}
                      className="rounded border-border-strong text-brand-purple focus:ring-brand-purple cursor-pointer disabled:opacity-40"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-semibold w-32">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Message Type</th>
                  <th className="py-2.5 px-3 font-semibold">Sending Endpoint</th>
                  <th className="py-2.5 px-3 font-semibold">Receiving Endpoint</th>
                  <th className="py-2.5 px-3 font-semibold">Time Sent</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-20">Attempts</th>
                  <th className="py-2.5 px-3 font-semibold">Conversation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {pagedData.items.map((m) => {
                  const isRowSelected = selectedIds.has(m.id);
                  const canAct = isActionable(m);

                  return (
                    <tr
                      key={m.id}
                      data-testid={`message-row-${m.id}`}
                      onClick={() => openMessageDrawer(m.id)}
                      className={`hover:bg-surface-hover cursor-pointer transition-colors ${
                        isRowSelected ? "bg-surface-subtle" : ""
                      }`}
                    >
                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          data-testid={`row-checkbox-${m.id}`}
                          aria-label={`Select message ${m.id}`}
                          checked={isRowSelected}
                          disabled={!canAct}
                          onChange={() => handleToggleRow(m.id)}
                          className="rounded border-border-strong text-brand-purple focus:ring-brand-purple cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
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
                        {m.sendingEndpoint || "—"}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-text-secondary text-[11px]">
                        {m.receivingEndpoint || "—"}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <TimestampCell iso={m.timeSent} />
                      </td>

                      <td className="py-2.5 px-3 font-mono text-center tabular-nums font-semibold text-text-primary">
                        {m.numberOfProcessingAttempts ?? "—"}
                      </td>

                      <td
                        className="py-2.5 px-3 font-mono text-xs text-text-secondary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {m.conversationId ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/conversations/${m.conversationId}`)
                            }
                            className="inline-flex items-center gap-1 text-brand-purple hover:underline cursor-pointer truncate max-w-[180px]"
                          >
                            <GitBranch className="w-3 h-3 shrink-0" />
                            <span className="truncate">{m.conversationId}</span>
                          </button>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 py-3 border-t border-border-subtle bg-surface-subtle flex items-center justify-between gap-4 flex-wrap text-xs">
            <div className="text-text-secondary font-mono">
              Showing{" "}
              <strong className="text-text-primary tabular-nums">
                {(page - 1) * pageSize + 1}
              </strong>{" "}
              –{" "}
              <strong className="text-text-primary tabular-nums">
                {Math.min(page * pageSize, pagedData.totalCount)}
              </strong>{" "}
              of{" "}
              <strong className="text-text-primary tabular-nums">
                {pagedData.totalCount}
              </strong>{" "}
              messages
            </div>

            <div className="flex items-center gap-2">
              <span className="text-text-muted font-mono tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                data-testid="pagination-prev"
                disabled={page <= 1}
                onClick={() => updateParam("page", String(page - 1))}
                className="p-1.5 rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-testid="pagination-next"
                disabled={page >= totalPages}
                onClick={() => updateParam("page", String(page + 1))}
                className="p-1.5 rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
