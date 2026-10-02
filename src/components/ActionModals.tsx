import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { getLogs } from "../api/client";
import {
  AppConfig,
  LogEvent,
  MessageDetail,
  MessageSummary,
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
} from "./Common";

// 1. Operator Name Prompt Modal
export const OperatorPromptModal: React.FC<{
  isOpen: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}> = ({ isOpen, onSave, onCancel }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) setName("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
  };

  return (
    <div
      data-testid="operator-prompt-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-surface border border-border-strong shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-brand-purple" />
            <h2 className="text-sm font-semibold text-text-primary">
              Operator Identity Required
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Please enter your operator name or engineering handle. This is stored
            in your browser and sent in the{" "}
            <code className="font-mono px-1 py-0.5 rounded bg-surface-subtle">
              X-Operator
            </code>{" "}
            header on every message action for audit logging.
          </p>
          <div>
            <label
              htmlFor="operator-prompt-input"
              className="block text-xs font-medium text-text-primary mb-1"
            >
              Operator Name
            </label>
            <input
              id="operator-prompt-input"
              data-testid="operator-prompt-input"
              type="text"
              autoFocus
              required
              placeholder="e.g. j.kovacs or marek.nowak"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="operator-prompt-submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded bg-brand-purple hover:bg-brand-purple-dark text-text-on-purple disabled:opacity-50 cursor-pointer"
            >
              Continue to Action
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. Retry / Archive Confirmation Dialog
export const ConfirmActionDialog: React.FC<{
  isOpen: boolean;
  actionType: "retry" | "archive" | "unarchive";
  messages: MessageSummary[];
  config: AppConfig;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  isOpen,
  actionType,
  messages,
  config,
  isSubmitting,
  onConfirm,
  onCancel,
}) => {
  const [prodConfirmText, setProdConfirmText] = useState("");

  useEffect(() => {
    if (isOpen) setProdConfirmText("");
  }, [isOpen]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of messages) {
      const short = shortTypeName(m.messageType);
      counts.set(short, (counts.get(short) || 0) + 1);
    }
    return Array.from(counts.entries());
  }, [messages]);

  if (!isOpen) return null;

  const isProd = config.environmentName.toUpperCase() === "PROD";
  const exceedsBatch =
    messages.length > config.actions.maxBatchSize && messages.length > 1;
  const canSubmit =
    !isSubmitting &&
    !exceedsBatch &&
    (!isProd || prodConfirmText.trim() === "PROD");

  const title =
    actionType === "retry"
      ? `Retry ${messages.length} Message${messages.length === 1 ? "" : "s"}`
      : actionType === "archive"
      ? `Archive ${messages.length} Message${messages.length === 1 ? "" : "s"}`
      : "Unarchive Message";

  return (
    <div
      data-testid="confirm-action-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-surface border border-border-strong shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            {actionType === "retry" ? (
              <RefreshCw className="w-4 h-4 text-brand-purple" />
            ) : (
              <Archive className="w-4 h-4 text-brand-purple" />
            )}
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {exceedsBatch && (
            <div
              data-testid="batch-limit-warning"
              className="p-3 rounded border text-xs flex items-start gap-2"
              style={{
                backgroundColor: "var(--status-failed-bg)",
                borderColor: "var(--status-failed-border)",
                color: "var(--status-failed-text)",
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Batch size limit exceeded:</strong> You selected{" "}
                <span className="font-mono font-semibold">
                  {messages.length}
                </span>{" "}
                messages, but the maximum batch size allowed in{" "}
                <span className="font-mono">{config.environmentName}</span> is{" "}
                <span className="font-mono font-semibold">
                  {config.actions.maxBatchSize}
                </span>
                . Please deselect some rows before proceeding.
              </div>
            </div>
          )}

          <div className="text-xs text-text-secondary">
            You are about to{" "}
            <span className="font-semibold text-text-primary">{actionType}</span>{" "}
            <span className="font-mono font-semibold text-text-primary tabular-nums">
              {messages.length}
            </span>{" "}
            message{messages.length === 1 ? "" : "s"} in environment{" "}
            <span className="font-mono font-semibold text-text-primary">
              {config.environmentName}
            </span>
            :
          </div>

          <div className="rounded border border-border-subtle bg-surface-subtle p-3 max-h-48 overflow-y-auto space-y-1.5">
            {typeCounts.map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between text-xs font-mono"
              >
                <span className="text-text-primary truncate">{type}</span>
                <span className="text-text-secondary tabular-nums ml-2">
                  ×{count}
                </span>
              </div>
            ))}
          </div>

          {isProd && (
            <div className="p-3 rounded border border-border-strong bg-surface-subtle space-y-2">
              <label
                htmlFor="prod-confirm-input"
                className="block text-xs font-semibold text-text-primary"
              >
                Production Safeguard: Type <code className="font-mono">PROD</code>{" "}
                to confirm
              </label>
              <input
                id="prod-confirm-input"
                data-testid="prod-confirm-input"
                type="text"
                value={prodConfirmText}
                onChange={(e) => setProdConfirmText(e.target.value)}
                placeholder="PROD"
                className="w-full px-3 py-1.5 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              data-testid="confirm-dialog-cancel"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-dialog-submit"
              disabled={!canSubmit}
              onClick={onConfirm}
              className="px-4 py-1.5 text-xs font-medium rounded bg-brand-purple hover:bg-brand-purple-dark text-text-on-purple disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                Confirm{" "}
                {actionType === "retry"
                  ? "Retry"
                  : actionType === "archive"
                  ? "Archive"
                  : "Unarchive"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. Full-Screen Edit and Retry Modal
export const EditRetryModal: React.FC<{
  isOpen: boolean;
  message: MessageDetail | null;
  config: AppConfig;
  isSubmitting: boolean;
  onSubmit: (id: string, body: string, headers: Record<string, string>) => void;
  onCancel: () => void;
}> = ({ isOpen, message, config, isSubmitting, onSubmit, onCancel }) => {
  const [editedBody, setEditedBody] = useState("");
  const [editedHeaders, setEditedHeaders] = useState<
    Array<{ key: string; value: string; locked: boolean }>
  >([]);
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderVal, setNewHeaderVal] = useState("");
  const [step, setStep] = useState<"edit" | "diff">("edit");
  const [prodConfirm, setProdConfirm] = useState("");

  useEffect(() => {
    if (isOpen && message) {
      setEditedBody(message.body || "{}");
      const lockedSet = new Set(message.lockedHeaders || []);
      const entries = Object.entries(message.headers || {}).map(([k, v]) => ({
        key: k,
        value: v,
        locked: lockedSet.has(k),
      }));
      setEditedHeaders(entries);
      setStep("edit");
      setNewHeaderKey("");
      setNewHeaderVal("");
      setProdConfirm("");
    }
  }, [isOpen, message]);

  const jsonValidation = useMemo(() => {
    if (!editedBody.trim()) {
      return { valid: false, error: "Message body cannot be empty." };
    }
    try {
      JSON.parse(editedBody);
      return { valid: true, error: null };
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : "Invalid JSON syntax",
      };
    }
  }, [editedBody]);

  if (!isOpen || !message) return null;

  const isProd = config.environmentName.toUpperCase() === "PROD";
  const canFinalSubmit =
    jsonValidation.valid &&
    !isSubmitting &&
    (!isProd || prodConfirm.trim() === "PROD");

  const handleHeaderChange = (idx: number, val: string) => {
    setEditedHeaders((prev) =>
      prev.map((item, i) => (i === idx && !item.locked ? { ...item, value: val } : item))
    );
  };

  const handleDeleteHeader = (idx: number) => {
    setEditedHeaders((prev) => prev.filter((item, i) => i !== idx || item.locked));
  };

  const handleAddHeader = () => {
    const k = newHeaderKey.trim();
    if (!k) return;
    if (editedHeaders.some((h) => h.key === k)) return;
    setEditedHeaders((prev) => [
      ...prev,
      { key: k, value: newHeaderVal, locked: false },
    ]);
    setNewHeaderKey("");
    setNewHeaderVal("");
  };

  const handleFormatJson = () => {
    if (jsonValidation.valid) {
      setEditedBody(JSON.stringify(JSON.parse(editedBody), null, 2));
    }
  };

  const buildHeadersRecord = (): Record<string, string> => {
    const rec: Record<string, string> = {};
    for (const h of editedHeaders) {
      rec[h.key] = h.value;
    }
    return rec;
  };

  // Compute line-by-line diff for side-by-side comparison
  const origBodyLines = (message.body || "").split("\n");
  const newBodyLines = editedBody.split("\n");
  const maxLines = Math.max(origBodyLines.length, newBodyLines.length);

  const origHeaders = message.headers || {};
  const finalHeaders = buildHeadersRecord();
  const allHeaderKeys = Array.from(
    new Set([...Object.keys(origHeaders), ...Object.keys(finalHeaders)])
  );
  const changedHeaderKeys = allHeaderKeys.filter(
    (k) => origHeaders[k] !== finalHeaders[k]
  );

  return (
    <div
      data-testid="edit-retry-dialog"
      className="fixed inset-0 z-50 flex flex-col bg-surface text-text-primary"
    >
      {/* Top Modal Header */}
      <div className="px-6 py-3.5 border-b border-border-subtle flex items-center justify-between bg-surface-subtle shrink-0">
        <div className="flex items-center gap-3">
          <Edit3 className="w-4 h-4 text-brand-purple" />
          <div>
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <span>Edit &amp; Retry Message</span>
              <span className="font-mono text-xs text-text-secondary">
                {shortTypeName(message.messageType)} ({message.messageId})
              </span>
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-border-strong bg-surface p-0.5 text-xs">
            <button
              type="button"
              data-testid="edit-retry-step-edit"
              onClick={() => setStep("edit")}
              className={`px-3 py-1 rounded font-medium cursor-pointer transition-colors ${
                step === "edit"
                  ? "bg-brand-purple text-text-on-purple"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              1. Edit Payload &amp; Headers
            </button>
            <button
              type="button"
              data-testid="edit-retry-step-diff"
              disabled={!jsonValidation.valid}
              onClick={() => setStep("diff")}
              className={`px-3 py-1 rounded font-medium cursor-pointer transition-colors disabled:opacity-40 ${
                step === "diff"
                  ? "bg-brand-purple text-text-on-purple"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              2. Review Side-by-Side Diff &amp; Confirm
            </button>
          </div>
          <button
            type="button"
            data-testid="edit-retry-close"
            onClick={onCancel}
            className="p-1.5 rounded hover:bg-surface-hover text-text-secondary cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Warning banner */}
      <div
        className="px-6 py-2.5 border-b text-xs flex items-center gap-2.5 shrink-0"
        style={{
          backgroundColor: "var(--status-retry-bg)",
          borderColor: "var(--status-retry-border)",
          color: "var(--status-retry-text)",
        }}
      >
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          <strong>Warning:</strong> Submitting an edited message will mark the
          original failed message (<code className="font-mono">{message.messageId}</code>)
          as <strong>resolved</strong> and dispatch a new message with the modified
          body and headers to{" "}
          <code className="font-mono">{message.receivingEndpoint}</code>.
        </span>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {step === "edit" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left: JSON Body Code Editor */}
            <div className="flex flex-col h-full min-h-[420px]">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="edit-retry-body-textarea"
                  className="text-xs font-semibold text-text-primary flex items-center gap-2"
                >
                  <span>Message Body (JSON)</span>
                  {jsonValidation.valid ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono"
                      style={{
                        backgroundColor: "var(--status-success-bg)",
                        color: "var(--status-success-text)",
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3" /> Valid JSON
                    </span>
                  ) : (
                    <span
                      data-testid="edit-retry-json-error"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono"
                      style={{
                        backgroundColor: "var(--status-failed-bg)",
                        color: "var(--status-failed-text)",
                      }}
                    >
                      <AlertTriangle className="w-3 h-3" /> {jsonValidation.error}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleFormatJson}
                  disabled={!jsonValidation.valid}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-secondary disabled:opacity-40 cursor-pointer"
                >
                  Format JSON
                </button>
              </div>
              <textarea
                id="edit-retry-body-textarea"
                data-testid="edit-retry-body-input"
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-4 font-mono text-xs leading-relaxed rounded-lg border border-border-strong bg-surface-subtle text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple resize-none"
              />
            </div>

            {/* Right: Editable Headers Table (lockedHeaders read-only) */}
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-primary">
                  Message Headers ({editedHeaders.length})
                </span>
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked system headers are read-only
                </span>
              </div>

              <div className="flex-1 rounded-lg border border-border-subtle overflow-hidden flex flex-col bg-surface">
                <div className="overflow-y-auto flex-1 divide-y divide-border-subtle">
                  {editedHeaders.map((h, idx) => (
                    <div
                      key={h.key}
                      className="p-2.5 flex items-start gap-2 text-xs hover:bg-surface-subtle"
                    >
                      <div className="w-56 shrink-0 font-mono text-[11px] text-text-secondary break-all pt-1.5 flex items-center gap-1.5">
                        {h.locked && (
                          <span title="Locked header (read-only)" className="shrink-0">
                            <Lock className="w-3 h-3 text-text-muted" />
                          </span>
                        )}
                        <span>{h.key}</span>
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          data-testid={`header-input-${h.key}`}
                          readOnly={h.locked}
                          disabled={h.locked}
                          value={h.value}
                          onChange={(e) => handleHeaderChange(idx, e.target.value)}
                          className={`w-full px-2.5 py-1 text-xs font-mono rounded border ${
                            h.locked
                              ? "border-border-subtle bg-surface-subtle text-text-muted cursor-not-allowed"
                              : "border-border-strong bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-purple"
                          }`}
                        />
                      </div>
                      {!h.locked && (
                        <button
                          type="button"
                          onClick={() => handleDeleteHeader(idx)}
                          title="Remove header"
                          className="p-1.5 text-text-muted hover:text-text-primary cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add custom header bar */}
                <div className="p-2.5 border-t border-border-subtle bg-surface-subtle flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="New header key"
                    value={newHeaderKey}
                    onChange={(e) => setNewHeaderKey(e.target.value)}
                    className="w-48 px-2.5 py-1 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary"
                  />
                  <input
                    type="text"
                    placeholder="Header value"
                    value={newHeaderVal}
                    onChange={(e) => setNewHeaderVal(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    disabled={!newHeaderKey.trim()}
                    className="px-2.5 py-1 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Side-by-side Diff View */
          <div data-testid="edit-retry-diff-view" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border-subtle overflow-hidden">
                <div className="px-4 py-2 bg-surface-subtle border-b border-border-subtle text-xs font-semibold text-text-secondary">
                  Original Body
                </div>
                <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed bg-surface">
                  {Array.from({ length: maxLines }).map((_, i) => {
                    const origLine = origBodyLines[i] ?? "";
                    const newLine = newBodyLines[i] ?? "";
                    const changed = origLine !== newLine;
                    return (
                      <div
                        key={i}
                        className="px-2 py-0.5 rounded-sm"
                        style={
                          changed
                            ? {
                                backgroundColor: "var(--status-failed-bg)",
                                color: "var(--status-failed-text)",
                              }
                            : undefined
                        }
                      >
                        <span className="inline-block w-7 select-none opacity-50 tabular-nums">
                          {i + 1}
                        </span>
                        {origLine}
                      </div>
                    );
                  })}
                </pre>
              </div>

              <div className="rounded-lg border border-border-subtle overflow-hidden">
                <div className="px-4 py-2 bg-surface-subtle border-b border-border-subtle text-xs font-semibold text-text-secondary">
                  Edited Body (To Be Dispatched)
                </div>
                <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed bg-surface">
                  {Array.from({ length: maxLines }).map((_, i) => {
                    const origLine = origBodyLines[i] ?? "";
                    const newLine = newBodyLines[i] ?? "";
                    const changed = origLine !== newLine;
                    return (
                      <div
                        key={i}
                        className="px-2 py-0.5 rounded-sm"
                        style={
                          changed
                            ? {
                                backgroundColor: "var(--status-success-bg)",
                                color: "var(--status-success-text)",
                              }
                            : undefined
                        }
                      >
                        <span className="inline-block w-7 select-none opacity-50 tabular-nums">
                          {i + 1}
                        </span>
                        {newLine}
                      </div>
                    );
                  })}
                </pre>
              </div>
            </div>

            {/* Header Diff Summary */}
            <div className="rounded-lg border border-border-subtle overflow-hidden bg-surface">
              <div className="px-4 py-2 bg-surface-subtle border-b border-border-subtle text-xs font-semibold text-text-secondary">
                Header Modifications ({changedHeaderKeys.length} changed)
              </div>
              {changedHeaderKeys.length === 0 ? (
                <div className="p-4 text-xs text-text-muted">
                  No headers were modified.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle text-xs font-mono">
                  {changedHeaderKeys.map((k) => (
                    <div
                      key={k}
                      className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-center"
                    >
                      <span className="font-semibold text-text-primary">{k}</span>
                      <span
                        className="px-2 py-1 rounded break-all"
                        style={{
                          backgroundColor: "var(--status-failed-bg)",
                          color: "var(--status-failed-text)",
                        }}
                      >
                        - {origHeaders[k] ?? "(none)"}
                      </span>
                      <span
                        className="px-2 py-1 rounded break-all"
                        style={{
                          backgroundColor: "var(--status-success-bg)",
                          color: "var(--status-success-text)",
                        }}
                      >
                        + {finalHeaders[k] ?? "(removed)"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isProd && (
              <div className="max-w-md p-4 rounded border border-border-strong bg-surface-subtle space-y-2">
                <label
                  htmlFor="edit-prod-confirm"
                  className="block text-xs font-semibold text-text-primary"
                >
                  Production Safeguard: Type <code className="font-mono">PROD</code>{" "}
                  to confirm dispatch
                </label>
                <input
                  id="edit-prod-confirm"
                  type="text"
                  value={prodConfirm}
                  onChange={(e) => setProdConfirm(e.target.value)}
                  placeholder="PROD"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded border border-border-strong bg-surface text-text-primary"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 border-t border-border-subtle bg-surface-subtle flex items-center justify-between shrink-0">
        <div className="text-xs text-text-secondary">
          Target endpoint:{" "}
          <span className="font-mono font-semibold text-text-primary">
            {message.receivingEndpoint}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-secondary cursor-pointer"
          >
            Cancel
          </button>
          {step === "edit" ? (
            <button
              type="button"
              data-testid="edit-retry-review-button"
              disabled={!jsonValidation.valid}
              onClick={() => setStep("diff")}
              className="px-4 py-1.5 text-xs font-medium rounded bg-brand-purple hover:bg-brand-purple-dark text-text-on-purple disabled:opacity-40 cursor-pointer"
            >
              Review Diff &amp; Confirm
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("edit")}
                className="px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary cursor-pointer"
              >
                Back to Editor
              </button>
              <button
                type="button"
                data-testid="edit-retry-submit-button"
                disabled={!canFinalSubmit}
                onClick={() =>
                  onSubmit(message.id, editedBody, buildHeadersRecord())
                }
                className="px-4 py-1.5 text-xs font-medium rounded bg-brand-purple hover:bg-brand-purple-dark text-text-on-purple disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5"
              >
                {isSubmitting && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Confirm Edit &amp; Retry</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// 4. Pivot Logs Modal (for "All logs for this request" / "All logs for this session")
export const PivotLogsModal: React.FC<{
  filter: { requestId?: string; sessionId?: string } | null;
  onClose: () => void;
}> = ({ filter, onClose }) => {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReturnType<typeof extractProblemDetails> | null>(
    null
  );
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchPivotLogs = async () => {
    if (!filter) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getLogs({
        requestId: filter.requestId,
        sessionId: filter.sessionId,
        includeNoise: true,
      });
      setLogs(data);
    } catch (e) {
      setError(extractProblemDetails(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filter) {
      fetchPivotLogs();
    }
  }, [filter]);

  if (!filter) return null;

  const label = filter.requestId
    ? `Request ID: ${filter.requestId}`
    : `Session ID: ${filter.sessionId}`;

  return (
    <div
      data-testid="pivot-logs-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-lg bg-surface border border-border-strong shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between bg-surface-subtle">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              Correlated Seq Logs — <span className="font-mono">{label}</span>
            </h2>
            <CopyButton
              value={filter.requestId || filter.sessionId || ""}
              label="Copy ID"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <SkeletonRows count={5} />
          ) : error ? (
            <ErrorState problem={error} onRetry={fetchPivotLogs} />
          ) : logs.length === 0 ? (
            <EmptyState
              title="No matching logs"
              description={`Seq returned 0 events for ${label}.`}
            />
          ) : (
            <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div key={log.id} className="bg-surface">
                    <div
                      onClick={() =>
                        setExpandedLogId(isExpanded ? null : log.id)
                      }
                      className="px-3 py-2.5 flex items-start gap-3 hover:bg-surface-hover cursor-pointer text-xs"
                    >
                      <span className="font-mono text-text-secondary whitespace-nowrap tabular-nums">
                        {formatLocalTime(log.timestamp)}
                      </span>
                      <LogLevelBadge level={log.level} />
                      <span className="font-mono text-text-primary flex-1 break-words">
                        {log.renderedMessage}
                      </span>
                      {log.application && (
                        <span className="font-mono text-[11px] text-text-muted whitespace-nowrap">
                          {log.application}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="px-4 py-3 bg-surface-subtle border-t border-border-subtle space-y-3 text-xs">
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                          {Object.entries(log.properties).map(([k, v]) => (
                            <div
                              key={k}
                              className="p-1.5 rounded bg-surface border border-border-subtle truncate"
                            >
                              <span className="text-text-muted">{k}: </span>
                              <span className="text-text-primary">
                                {String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end">
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
      </div>
    </div>
  );
};
