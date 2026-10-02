import React from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitCommit,
  RefreshCw,
  Tag,
  User,
} from "lucide-react";
import { type RelatedTicket, type RelatedTicketsResult } from "../api/types";
import { formatLocalTime, formatRelativeTime } from "../utils/format";
import { EmptyState, SkeletonRows } from "./Common";

function highlightMatchedTerm(
  excerpt: string,
  highlightTerms: string[]
): React.ReactNode {
  const cleanTerms = highlightTerms
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  if (cleanTerms.length === 0) return excerpt;

  const escaped = cleanTerms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = excerpt.split(regex);

  return parts.map((part, idx) => {
    const isMatch = cleanTerms.some(
      (t) => t.toLowerCase() === part.toLowerCase()
    );
    if (isMatch) {
      return (
        <mark
          key={idx}
          className="px-1 py-0.2 rounded font-semibold"
          style={{
            backgroundColor: "var(--brand-lime)",
            color: "var(--text-on-lime)",
          }}
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

const StatusCategoryBadge: React.FC<{
  status: string;
  category: "todo" | "inProgress" | "done";
}> = ({ status, category }) => {
  if (category === "done") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap"
        style={{
          backgroundColor: "var(--status-success-bg)",
          color: "var(--status-success-text)",
          borderColor: "var(--status-success-border)",
        }}
      >
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  if (category === "inProgress") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap"
        style={{
          backgroundColor: "var(--status-retry-bg)",
          color: "var(--status-retry-text)",
          borderColor: "var(--status-retry-border)",
        }}
      >
        <Clock className="w-3 h-3 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap"
      style={{
        backgroundColor: "var(--status-archived-bg)",
        color: "var(--status-archived-text)",
        borderColor: "var(--status-archived-border)",
      }}
    >
      <span>{status}</span>
    </span>
  );
};

export const TicketCard: React.FC<{
  item: RelatedTicket;
  highlightTerms?: string[];
}> = ({ item, highlightTerms = [] }) => {
  const { ticket, reason } = item;
  const relevantDate = ticket.resolved || ticket.updated;
  const dateLabel = ticket.resolved ? "Resolved" : "Updated";

  const terms = [
    ...highlightTerms,
    "OUTINT00118618",
    "ExpireSoftLockCommand",
    "PostEndorsementLedgerEntryCommand",
    "PublishRenewalInviteCommand",
    "PreconditionFailed",
    "TaxJurisdictionMappingException",
    "SubRegionCode",
    "PolicySoftLockSaga",
  ];

  return (
    <div
      data-testid={`jira-ticket-card-${ticket.key}`}
      className="p-3.5 rounded-lg border border-border-subtle bg-surface hover:border-border-strong transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={ticket.url}
            target="_blank"
            rel="noreferrer"
            data-testid={`jira-ticket-link-${ticket.key}`}
            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-brand-purple hover:underline"
          >
            <span>{ticket.key}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs font-medium text-text-secondary">
            {ticket.issueType}
          </span>
        </div>
        <StatusCategoryBadge
          status={ticket.status}
          category={ticket.statusCategory}
        />
      </div>

      <h4 className="text-xs font-semibold text-text-primary leading-snug">
        {ticket.summary}
      </h4>

      <p className="text-xs text-text-secondary leading-relaxed bg-surface-subtle px-2.5 py-1.5 rounded border border-border-subtle">
        {reason}
      </p>

      {ticket.excerpt && (
        <div className="text-[11px] font-mono text-text-secondary bg-surface-subtle p-2 rounded border border-border-subtle leading-relaxed break-words">
          {highlightMatchedTerm(ticket.excerpt, terms)}
        </div>
      )}

      <div className="pt-1 flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>{ticket.assignee || "Unassigned"}</span>
        </span>
        {ticket.components.length > 0 && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Tag className="w-3 h-3" />
              <span>{ticket.components.join(", ")}</span>
            </span>
          </>
        )}
        <span>·</span>
        <span
          className="inline-flex items-center gap-1 font-mono tabular-nums"
          title={formatLocalTime(relevantDate)}
        >
          <Calendar className="w-3 h-3" />
          <span>
            {dateLabel} {formatRelativeTime(relevantDate)}
          </span>
        </span>
      </div>
    </div>
  );
};

export const RelatedTicketsPanel: React.FC<{
  result: RelatedTicketsResult | null;
  loading: boolean;
  onRetry: () => void;
  showOnTimeline?: boolean;
  onToggleShowOnTimeline?: (val: boolean) => void;
  highlightTerms?: string[];
}> = ({
  result,
  loading,
  onRetry,
  showOnTimeline,
  onToggleShowOnTimeline,
  highlightTerms = [],
}) => {
  if (result && !result.enabled) {
    return null;
  }

  const possibleCauses =
    result?.tickets.filter((t) => t.hint === "possibleCause") || [];
  const possibleFixes =
    result?.tickets.filter((t) => t.hint === "possibleFix") || [];
  const alsoRelated =
    result?.tickets.filter((t) => t.hint === "related") || [];

  const resolvedCount =
    result?.tickets.filter((t) => Boolean(t.ticket.resolved)).length || 0;

  return (
    <div
      data-testid="related-tickets-panel"
      className="rounded-lg border border-border-subtle bg-surface flex flex-col overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border-subtle bg-surface-subtle flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-text-primary flex items-center gap-2">
            <span>Related Jira Tickets</span>
            {result && result.ok && (
              <span className="font-mono text-text-muted tabular-nums">
                ({result.tickets.length})
              </span>
            )}
          </h3>
        </div>
        {onToggleShowOnTimeline !== undefined && (
          <label
            data-testid="show-tickets-on-timeline-toggle"
            className="inline-flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none"
            title="Plot resolved Jira tickets on the policy timeline"
          >
            <input
              type="checkbox"
              checked={Boolean(showOnTimeline)}
              onChange={(e) => onToggleShowOnTimeline(e.target.checked)}
              disabled={resolvedCount === 0}
              className="rounded border-border-strong text-brand-purple focus:ring-brand-purple cursor-pointer"
            />
            <GitCommit className="w-3.5 h-3.5 text-brand-purple" />
            <span>Show on timeline</span>
          </label>
        )}
      </div>

      <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-220px)]">
        {loading ? (
          <SkeletonRows count={4} height="h-24" />
        ) : result && !result.ok ? (
          <div
            data-testid="jira-error-banner"
            className="p-4 rounded-lg border space-y-3"
            style={{
              backgroundColor: "var(--status-failed-bg)",
              borderColor: "var(--status-failed-border)",
              color: "var(--status-failed-text)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-semibold">Jira Integration Error</div>
                <p className="opacity-90 leading-relaxed">
                  {result.error || "Unable to fetch related Jira issues."}
                </p>
              </div>
            </div>
            <button
              type="button"
              data-testid="jira-retry-button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-surface text-text-primary border border-border-strong hover:bg-surface-hover cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Jira Lookup</span>
            </button>
          </div>
        ) : !result || result.tickets.length === 0 ? (
          <EmptyState
            title="No related Jira tickets"
            description="No Jira issues matched this policy number, exception type, or recent component deployments."
          />
        ) : (
          <>
            {possibleCauses.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                  <span>Possible causes</span>
                  <span className="font-mono text-[11px] text-text-muted tabular-nums">
                    {possibleCauses.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {possibleCauses.map((item) => (
                    <TicketCard
                      key={item.ticket.key}
                      item={item}
                      highlightTerms={highlightTerms}
                    />
                  ))}
                </div>
              </div>
            )}

            {possibleFixes.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                  <span>Possible fixes</span>
                  <span className="font-mono text-[11px] text-text-muted tabular-nums">
                    {possibleFixes.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {possibleFixes.map((item) => (
                    <TicketCard
                      key={item.ticket.key}
                      item={item}
                      highlightTerms={highlightTerms}
                    />
                  ))}
                </div>
              </div>
            )}

            {alsoRelated.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                  <span>Also related</span>
                  <span className="font-mono text-[11px] text-text-muted tabular-nums">
                    {alsoRelated.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {alsoRelated.map((item) => (
                    <TicketCard
                      key={item.ticket.key}
                      item={item}
                      highlightTerms={highlightTerms}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
