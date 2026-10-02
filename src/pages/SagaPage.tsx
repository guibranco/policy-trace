import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerDownRight,
  Radio,
  RefreshCw,
  Send,
  Workflow,
} from "lucide-react";
import { getSaga } from "../api/client";
import { SagaHistory, SagaMessage } from "../api/types";
import { CopyButton, EmptyState, ErrorState, SkeletonRows } from "../components/Common";
import { useAppContext } from "../context/AppContext";
import {
  extractProblemDetails,
  formatLocalTime,
  formatShortTime,
  shortTypeName,
} from "../utils/format";

function computeJsonDiff(
  prevJsonStr: string | null,
  currJsonStr: string
): {
  parsed: Record<string, unknown>;
  diffKeys: Set<string>;
} {
  let curr: Record<string, unknown> = {};
  let prev: Record<string, unknown> = {};
  try {
    curr = JSON.parse(currJsonStr);
  } catch {
    curr = { raw: currJsonStr };
  }
  if (prevJsonStr) {
    try {
      prev = JSON.parse(prevJsonStr);
    } catch {
      prev = { raw: prevJsonStr };
    }
  }

  const diffKeys = new Set<string>();
  for (const k of Object.keys(curr)) {
    if (JSON.stringify(curr[k]) !== JSON.stringify(prev[k])) {
      diffKeys.add(k);
    }
  }

  return { parsed: curr, diffKeys };
}

export const SagaPage: React.FC = () => {
  const { sagaId = "" } = useParams<{ sagaId: string }>();
  const navigate = useNavigate();
  const { openMessageDrawer, refreshVersion } = useAppContext();

  const [saga, setSaga] = useState<SagaHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof extractProblemDetails> | null>(null);

  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const fetchSaga = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSaga(sagaId);
      setSaga(data);
      // Auto expand the last step
      if (data.changes.length > 0) {
        setExpandedSteps({ [data.changes.length - 1]: true });
      }
    } catch (e) {
      setError(extractProblemDetails(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaga();
  }, [sagaId, refreshVersion]);

  const isCompleted =
    saga?.changes.some((c) => c.status === "completed") ?? false;

  const toggleStep = (idx: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const renderMessageCard = (
    msg: SagaMessage,
    isInitiator: boolean
  ) => {
    return (
      <div
        data-testid={`saga-msg-${msg.messageId}`}
        onClick={() => openMessageDrawer(msg.messageId)}
        className="p-3 rounded-lg border border-border-strong bg-surface hover:border-brand-purple transition-colors cursor-pointer text-left space-y-1.5 shadow-2xs group"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {msg.isTimeout ? (
              <Clock className="w-3.5 h-3.5 text-brand-purple shrink-0" />
            ) : msg.intent.toLowerCase() === "publish" ? (
              <Radio className="w-3.5 h-3.5 text-text-secondary shrink-0" />
            ) : (
              <Send className="w-3.5 h-3.5 text-text-secondary shrink-0" />
            )}
            <span
              title={msg.messageType}
              className="font-mono text-xs font-semibold text-text-primary group-hover:underline truncate"
            >
              {shortTypeName(msg.messageType)}
            </span>
          </div>

          {msg.isTimeout && msg.deliveryDelay && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0"
              style={{
                backgroundColor: "var(--brand-lime)",
                color: "var(--text-on-lime)",
              }}
            >
              <Clock className="w-3 h-3" />
              <span>+{msg.deliveryDelay}</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-text-muted">
          <span>{msg.destination || "policy-admin"}</span>
          <span className="tabular-nums">{formatShortTime(msg.timeSent)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-5 max-w-[1500px] mx-auto space-y-5">
      {/* Top Header Card */}
      <div className="p-4 rounded-lg border border-border-subtle bg-surface flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 rounded hover:bg-surface-hover text-text-secondary cursor-pointer"
            title="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Workflow className="w-5 h-5 text-brand-purple" />
              <h1 className="text-base font-bold font-mono text-text-primary">
                {sagaId}
              </h1>
              <CopyButton value={sagaId} label="Copy ID" />
              <span
                className="px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider"
                style={
                  isCompleted
                    ? {
                        backgroundColor: "var(--status-success-bg)",
                        color: "var(--status-success-text)",
                        border: "1px solid var(--status-success-border)",
                      }
                    : {
                        backgroundColor: "var(--status-retry-bg)",
                        color: "var(--status-retry-text)",
                        border: "1px solid var(--status-retry-border)",
                      }
                }
              >
                {isCompleted ? "Completed" : "Active"}
              </span>
            </div>
            {saga && (
              <p className="text-xs font-mono text-text-muted mt-1">
                {saga.sagaType}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSaga}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload Saga</span>
        </button>
      </div>

      {/* Main Saga Timeline */}
      {loading ? (
        <SkeletonRows count={6} height="h-28" />
      ) : error ? (
        <ErrorState problem={error} onRetry={fetchSaga} />
      ) : !saga || saga.changes.length === 0 ? (
        <EmptyState
          title="No saga changes recorded"
          description="ServiceControl has no transition history for this saga ID."
        />
      ) : (
        <div className="space-y-6">
          {/* Column Header Titles */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">
            <div className="md:col-span-4">Initiating Message (Incoming)</div>
            <div className="md:col-span-4 text-center">
              Saga State Transition
            </div>
            <div className="md:col-span-4">Outgoing Messages / Timeouts</div>
          </div>

          {/* Timeline Steps */}
          <div className="space-y-6 relative">
            {/* Center connector line */}
            <div className="hidden md:block absolute left-1/2 top-4 bottom-4 -translate-x-1/2 w-0.5 bg-border-strong pointer-events-none" />

            {saga.changes.map((change, idx) => {
              const isExpanded = Boolean(expandedSteps[idx]);
              const prevJsonStr =
                idx > 0 ? saga.changes[idx - 1].stateAfterChange : null;
              const { parsed, diffKeys } = computeJsonDiff(
                prevJsonStr,
                change.stateAfterChange
              );

              return (
                <div
                  key={idx}
                  data-testid={`saga-step-${idx}`}
                  className="rounded-lg border border-border-subtle bg-surface shadow-xs overflow-hidden"
                >
                  {/* Three-Column Step Row */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Column 1: Initiating message */}
                    <div className="md:col-span-4">
                      {change.initiatingMessage ? (
                        renderMessageCard(change.initiatingMessage, true)
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </div>

                    {/* Column 2: Saga state change in middle */}
                    <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-1.5 p-2 bg-surface-subtle rounded-lg border border-border-subtle">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider font-mono"
                          style={
                            change.status === "new"
                              ? {
                                  backgroundColor: "var(--brand-purple)",
                                  color: "var(--text-on-purple)",
                                }
                              : change.status === "completed"
                              ? {
                                  backgroundColor: "var(--status-success-bg)",
                                  color: "var(--status-success-text)",
                                }
                              : {
                                  backgroundColor: "var(--surface-hover)",
                                  color: "var(--text-primary)",
                                }
                          }
                        >
                          Step {idx + 1}: {change.status}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-text-muted tabular-nums">
                        {formatLocalTime(change.startTime)}
                      </div>

                      <button
                        type="button"
                        data-testid={`saga-step-expand-${idx}`}
                        onClick={() => toggleStep(idx)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-purple hover:underline cursor-pointer pt-1"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isExpanded ? "Hide state diff" : "Inspect state diff"}
                        </span>
                      </button>
                    </div>

                    {/* Column 3: Outgoing messages & timeouts */}
                    <div className="md:col-span-4 space-y-2">
                      {change.outgoingMessages.length === 0 ? (
                        <div className="text-xs font-mono text-text-muted p-3 bg-surface-subtle rounded-lg border border-dashed border-border-subtle text-center">
                          No outgoing messages
                        </div>
                      ) : (
                        change.outgoingMessages.map((outMsg) => (
                          <React.Fragment key={outMsg.messageId}>
                            {renderMessageCard(outMsg, false)}
                          </React.Fragment>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Expanded State JSON with Diff against previous step */}
                  {isExpanded && (
                    <div
                      data-testid={`saga-step-diff-${idx}`}
                      className="px-5 py-4 border-t border-border-subtle bg-surface-subtle space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-text-primary">
                          Saga State After Change
                          {idx > 0 && (
                            <span className="text-text-muted font-normal ml-2">
                              (highlighted properties changed in this step)
                            </span>
                          )}
                        </span>
                        <CopyButton
                          value={JSON.stringify(parsed, null, 2)}
                          label="Copy State JSON"
                        />
                      </div>

                      <div className="rounded border border-border-strong bg-surface p-3 font-mono text-xs overflow-x-auto space-y-1">
                        {Object.entries(parsed).map(([key, val]) => {
                          const isChanged = diffKeys.has(key);
                          const valStr = JSON.stringify(val);

                          return (
                            <div
                              key={key}
                              className={`px-2 py-0.5 rounded ${
                                isChanged
                                  ? "font-semibold"
                                  : "text-text-secondary"
                              }`}
                              style={
                                isChanged
                                  ? {
                                      backgroundColor: "var(--brand-lime)",
                                      color: "var(--text-on-lime)",
                                    }
                                  : undefined
                              }
                            >
                              <span className="opacity-90">{key}: </span>
                              <span>{valStr}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
