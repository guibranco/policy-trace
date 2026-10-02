import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Info,
  RefreshCw,
  Terminal,
  XCircle,
} from "lucide-react";
import { type MessageStatus, type ProblemDetails } from "../api/types";
import {
  formatLocalTime,
  formatRelativeTime,
  formatUtcTime,
} from "../utils/format";

export const StatusBadge: React.FC<{
  status: MessageStatus;
  size?: "sm" | "md";
}> = ({ status, size = "sm" }) => {
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  switch (status) {
    case "successful":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border whitespace-nowrap ${pad}`}
          style={{
            backgroundColor: "var(--status-success-bg)",
            color: "var(--status-success-text)",
            borderColor: "var(--status-success-border)",
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Successful</span>
        </span>
      );
    case "resolved":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border whitespace-nowrap ${pad}`}
          style={{
            backgroundColor: "var(--status-success-bg)",
            color: "var(--status-success-text)",
            borderColor: "var(--status-success-border)",
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Resolved</span>
        </span>
      );
    case "failed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border whitespace-nowrap ${pad}`}
          style={{
            backgroundColor: "var(--status-failed-bg)",
            color: "var(--status-failed-text)",
            borderColor: "var(--status-failed-border)",
          }}
        >
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Failed</span>
        </span>
      );
    case "repeatedFailure":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border whitespace-nowrap ${pad}`}
          style={{
            backgroundColor: "var(--status-failed-bg)",
            color: "var(--status-failed-text)",
            borderColor: "var(--status-failed-border)",
          }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Repeated failure</span>
        </span>
      );
    case "retryIssued":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border whitespace-nowrap ${pad}`}
          style={{
            backgroundColor: "var(--status-retry-bg)",
            color: "var(--status-retry-text)",
            borderColor: "var(--status-retry-border)",
          }}
        >
          <Clock className="w-3.5 h-3.5 shrink-0 animate-spin" />
          <span>Retry issued</span>
        </span>
      );
    case "archived":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded border whitespace-nowrap ${pad}`}
          style={{
            backgroundColor: "var(--status-archived-bg)",
            color: "var(--status-archived-text)",
            borderColor: "var(--status-archived-border)",
          }}
        >
          <Archive className="w-3.5 h-3.5 shrink-0" />
          <span>Archived</span>
        </span>
      );
  }
};

export const LogLevelBadge: React.FC<{ level: string }> = ({ level }) => {
  const norm = level.toLowerCase();
  if (norm === "fatal") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono font-semibold rounded whitespace-nowrap"
        style={{
          backgroundColor: "var(--log-fatal-bg)",
          color: "var(--log-fatal-text)",
        }}
      >
        <XCircle className="w-3 h-3 shrink-0" />
        <span>FTL</span>
      </span>
    );
  }
  if (norm === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono font-semibold rounded whitespace-nowrap"
        style={{
          backgroundColor: "var(--log-error-bg)",
          color: "var(--log-error-text)",
        }}
      >
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>ERR</span>
      </span>
    );
  }
  if (norm === "warning") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono font-semibold rounded whitespace-nowrap"
        style={{
          backgroundColor: "var(--log-warn-bg)",
          color: "var(--log-warn-text)",
        }}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>WRN</span>
      </span>
    );
  }
  if (norm === "information") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono font-medium rounded whitespace-nowrap"
        style={{
          backgroundColor: "var(--log-info-bg)",
          color: "var(--log-info-text)",
        }}
      >
        <Info className="w-3 h-3 shrink-0" />
        <span>INF</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono rounded whitespace-nowrap"
      style={{
        backgroundColor: "var(--log-debug-bg)",
        color: "var(--log-debug-text)",
      }}
    >
      <Terminal className="w-3 h-3 shrink-0" />
      <span>{norm === "verbose" ? "VRB" : "DBG"}</span>
    </span>
  );
};

export const EnvironmentBadge: React.FC<{ env: string }> = ({ env }) => {
  const upper = env.toUpperCase();
  const isProd = upper === "PROD";
  const isStg = upper === "STG";

  const style = isProd
    ? {
        backgroundColor: "var(--env-prod-bg)",
        color: "var(--env-prod-text)",
      }
    : isStg
    ? {
        backgroundColor: "var(--env-stg-bg)",
        color: "var(--env-stg-text)",
      }
    : {
        backgroundColor: "var(--env-int-bg)",
        color: "var(--env-int-text)",
      };

  return (
    <span
      data-testid="environment-badge"
      className="inline-flex items-center px-2.5 py-0.5 text-xs font-mono font-semibold tracking-wider rounded whitespace-nowrap"
      style={style}
      title={`Connected environment: ${upper}`}
    >
      {upper}
    </span>
  );
};

export const CopyButton: React.FC<{
  value: string;
  label?: string;
  className?: string;
}> = ({ value, label, className = "" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy ${label || value}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border border-border-subtle bg-surface-subtle hover:bg-surface-hover text-text-secondary transition-colors cursor-pointer whitespace-nowrap ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 shrink-0" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 shrink-0" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
};

export const TimestampCell: React.FC<{
  iso: string | null | undefined;
  showRelative?: boolean;
  className?: string;
}> = ({ iso, showRelative = true, className = "" }) => {
  if (!iso) {
    return <span className="text-text-muted font-mono text-xs">—</span>;
  }
  const local = formatLocalTime(iso);
  const utc = formatUtcTime(iso);
  const rel = formatRelativeTime(iso);

  return (
    <span
      title={utc}
      className={`inline-flex items-baseline gap-1.5 font-mono text-xs tabular-nums whitespace-nowrap ${className}`}
    >
      <span className="text-text-primary">{local}</span>
      {showRelative && rel && (
        <span className="text-text-muted text-[11px]">({rel})</span>
      )}
    </span>
  );
};

export const ErrorState: React.FC<{
  problem: ProblemDetails;
  onRetry?: () => void;
  testId?: string;
}> = ({ problem, onRetry, testId = "error-state" }) => {
  return (
    <div
      data-testid={testId}
      className="p-4 rounded-lg border bg-surface flex items-start justify-between gap-4"
      style={{
        borderColor: "var(--status-failed-border)",
        backgroundColor: "var(--status-failed-bg)",
        color: "var(--status-failed-text)",
      }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            <span>{problem.title}</span>
            {problem.status > 0 && (
              <span className="font-mono text-xs opacity-80">
                (HTTP {problem.status})
              </span>
            )}
          </div>
          <p className="text-xs mt-1 opacity-90 leading-relaxed">
            {problem.detail}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          data-testid="error-retry-button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-surface text-text-primary border border-border-strong hover:bg-surface-hover transition-colors shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

export const SkeletonRows: React.FC<{ count?: number; height?: string }> = ({
  count = 6,
  height = "h-10",
}) => {
  return (
    <div data-testid="loading-skeleton" className="space-y-2 py-2">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`w-full ${height} rounded bg-surface-subtle animate-pulse border border-border-subtle`}
        />
      ))}
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
  testId?: string;
}> = ({ title, description, action, testId = "empty-state" }) => {
  return (
    <div
      data-testid={testId}
      className="p-8 rounded-lg border border-border-subtle bg-surface text-center max-w-xl mx-auto my-4"
    >
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="text-xs text-text-secondary mt-1 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
};
