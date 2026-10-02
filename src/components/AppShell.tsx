import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Inbox,
  Moon,
  Search,
  Sun,
  User,
  X,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import {
  ConfirmActionDialog,
  EditRetryModal,
  OperatorPromptModal,
  PivotLogsModal,
} from "./ActionModals";
import { EnvironmentBadge } from "./Common";
import { MessageDetailView } from "./MessageDetailView";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    config,
    operatorName,
    updateOperatorName,
    theme,
    toggleTheme,
    drawerMessageId,
    openMessageDrawer,
    closeMessageDrawer,
    pivotLogFilter,
    openPivotLogs,
    closePivotLogs,
    triggerAction,
    refreshVersion,
    toasts,
    dismissToast,
    operatorPromptOpen,
    handleOperatorPromptSubmit,
    handleOperatorPromptCancel,
    confirmDialogState,
    editRetryState,
    isSubmittingAction,
    executeConfirmedAction,
    executeEditRetryAction,
    cancelActionModals,
  } = useAppContext();

  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Extract policy number if currently on /policy/:policyNumber
  const currentPolicyMatch = location.pathname.match(/^\/policy\/([^/]+)/);
  const activePolicyNumber = currentPolicyMatch
    ? decodeURIComponent(currentPolicyMatch[1])
    : "OUTINT00118618";

  const [searchValue, setSearchValue] = useState(activePolicyNumber);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editingOperator, setEditingOperator] = useState(false);
  const [operatorDraft, setOperatorDraft] = useState(operatorName);

  useEffect(() => {
    if (currentPolicyMatch) {
      setSearchValue(decodeURIComponent(currentPolicyMatch[1]));
      setValidationError(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    setOperatorDraft(operatorName);
  }, [operatorName]);

  // Global keyboard shortcuts: `/` focuses search, `Esc` closes drawers/modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "/" && !isEditable) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "Escape") {
        if (operatorPromptOpen) {
          handleOperatorPromptCancel();
        } else if (confirmDialogState || editRetryState) {
          cancelActionModals();
        } else if (pivotLogFilter) {
          closePivotLogs();
        } else if (drawerMessageId) {
          closeMessageDrawer();
        } else if (editingOperator) {
          setEditingOperator(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    operatorPromptOpen,
    confirmDialogState,
    editRetryState,
    pivotLogFilter,
    drawerMessageId,
    editingOperator,
    handleOperatorPromptCancel,
    cancelActionModals,
    closePivotLogs,
    closeMessageDrawer,
  ]);

  const validatePolicy = (val: string): boolean => {
    const trimmed = val.trim().toUpperCase();
    if (!trimmed) {
      setValidationError("Enter a policy number");
      return false;
    }
    try {
      const regex = new RegExp(config.policyNumberPattern);
      if (!regex.test(trimmed)) {
        setValidationError(
          `Must match ${config.policyNumberPattern} (e.g. OUTINT00118618)`
        );
        return false;
      }
    } catch {
      // ignore invalid regex in config
    }
    setValidationError(null);
    return true;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim().toUpperCase();
    if (!validatePolicy(trimmed)) return;
    setSearchValue(trimmed);
    navigate(`/policy/${encodeURIComponent(trimmed)}`);
  };

  const handleOperatorSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateOperatorName(operatorDraft);
    setEditingOperator(false);
  };

  const isProd = config.environmentName.toUpperCase() === "PROD";

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text-primary">
      {/* Top Bar */}
      <header
        className="sticky top-0 z-30 shadow-xs"
        style={{
          background:
            "linear-gradient(90deg, var(--brand-purple) 0%, var(--brand-purple-dark) 100%)",
          color: "var(--text-on-purple)",
        }}
      >
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          {/* Brand Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/policy/${activePolicyNumber}`)}
              className="text-base font-bold tracking-tight text-white cursor-pointer whitespace-nowrap"
            >
              PolicyTrace
            </button>
          </div>

          {/* Large Policy Number Search Box */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-xl relative"
          >
            <div className="flex items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-white/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  data-testid="policy-search-input"
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder={`Search policy number (${config.policyNumberPattern}) — press / to focus`}
                  aria-label="Policy number search"
                  className="w-full pl-9 pr-16 py-1.5 text-xs font-mono rounded-l bg-black/25 text-white placeholder-white/60 border border-white/25 focus:outline-none focus:border-brand-lime focus:ring-1 focus:ring-brand-lime"
                />
                <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-white/70 bg-black/20 rounded border border-white/15 pointer-events-none">
                  /
                </kbd>
              </div>
              <button
                type="submit"
                data-testid="policy-search-button"
                style={{
                  backgroundColor: "var(--brand-lime)",
                  color: "var(--text-on-lime)",
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-r border border-l-0 border-white/25 hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap"
              >
                Lookup
              </button>
            </div>
            {validationError && (
              <div
                data-testid="policy-search-error"
                className="absolute left-0 top-full mt-1 px-2.5 py-1 rounded text-[11px] font-mono shadow-md z-40"
                style={{
                  backgroundColor: "var(--status-failed-bg)",
                  color: "var(--status-failed-text)",
                  border: "1px solid var(--status-failed-border)",
                }}
              >
                {validationError}
              </div>
            )}
          </form>

          {/* Right Controls: Environment Badge + Operator Name + Theme Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <EnvironmentBadge env={config.environmentName} />

            {/* Operator Name Control */}
            {editingOperator ? (
              <form
                onSubmit={handleOperatorSave}
                className="flex items-center gap-1"
              >
                <input
                  data-testid="operator-name-input"
                  type="text"
                  autoFocus
                  value={operatorDraft}
                  onChange={(e) => setOperatorDraft(e.target.value)}
                  placeholder="Operator handle"
                  className="w-36 px-2 py-1 text-xs font-mono rounded bg-black/30 text-white border border-white/30 focus:outline-none focus:border-brand-lime"
                />
                <button
                  type="submit"
                  data-testid="operator-name-save"
                  style={{
                    backgroundColor: "var(--brand-lime)",
                    color: "var(--text-on-lime)",
                  }}
                  className="px-2 py-1 text-xs font-semibold rounded cursor-pointer"
                >
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                data-testid="operator-name-button"
                onClick={() => setEditingOperator(true)}
                title="Set operator name sent in X-Operator header"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-black/20 hover:bg-black/30 border border-white/20 text-white cursor-pointer whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 opacity-80" />
                <span className="font-mono">
                  {operatorName || "Set operator"}
                </span>
              </button>
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              data-testid="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              className="p-1.5 rounded bg-black/20 hover:bg-black/30 border border-white/20 text-white cursor-pointer"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Persistent PROD strip when environmentName is PROD */}
        {isProd && (
          <div
            data-testid="prod-warning-strip"
            className="px-4 py-1 text-xs font-semibold text-center flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--env-prod-bg)",
              color: "var(--env-prod-text)",
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Production: actions affect live messages</span>
          </div>
        )}
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 flex min-h-0">
        {/* Left Navigation */}
        <aside className="w-56 shrink-0 border-r border-border-subtle bg-surface flex flex-col justify-between">
          <nav className="p-3 space-y-1">
            <NavLink
              to={`/policy/${encodeURIComponent(activePolicyNumber)}`}
              data-testid="nav-policy-lookup"
              className={({ isActive }) => {
                const active =
                  isActive || location.pathname.startsWith("/policy/");
                return `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-brand-purple text-text-on-purple font-semibold"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`;
              }}
            >
              <FileSearch className="w-4 h-4 shrink-0" />
              <span>Policy lookup</span>
            </NavLink>

            <NavLink
              to="/messages"
              end
              data-testid="nav-messages"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-brand-purple text-text-on-purple font-semibold"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`
              }
            >
              <Inbox className="w-4 h-4 shrink-0" />
              <span>Messages</span>
            </NavLink>

            <NavLink
              to="/failed"
              data-testid="nav-failed-messages"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-brand-purple text-text-on-purple font-semibold"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`
              }
            >
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>Failed messages</span>
            </NavLink>
          </nav>

          {/* Sample policies quick switcher in sidebar footer for fast diagnostic navigation */}
          <div className="p-3 border-t border-border-subtle space-y-2">
            <div className="text-[11px] font-medium text-text-muted">
              Recent Diagnostic Policies
            </div>
            <div className="space-y-1">
              {[
                {
                  id: "OUTINT00118618",
                  desc: "40 items · 3 convs · Saga",
                },
                {
                  id: "OUTINT00229401",
                  desc: "Jira error · Logs truncated",
                },
                {
                  id: "OUTINT00334512",
                  desc: "Seq source offline",
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`quick-policy-${p.id}`}
                  onClick={() => navigate(`/policy/${p.id}`)}
                  className={`w-full text-left px-2.5 py-1.5 rounded border text-xs transition-colors cursor-pointer ${
                    activePolicyNumber === p.id &&
                    location.pathname.startsWith("/policy/")
                      ? "border-brand-purple bg-surface-subtle"
                      : "border-transparent hover:bg-surface-hover"
                  }`}
                >
                  <div className="font-mono font-semibold text-text-primary">
                    {p.id}
                  </div>
                  <div className="text-[11px] text-text-muted truncate">
                    {p.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>

      {/* Global Message Detail Slide-Over Drawer */}
      {drawerMessageId && (
        <div
          data-testid="message-detail-drawer"
          className="fixed inset-0 z-40 flex justify-end bg-black/40"
          onClick={closeMessageDrawer}
        >
          <div
            className="w-full max-w-3xl h-full bg-surface border-l border-border-strong shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageDetailView
              messageId={drawerMessageId}
              config={config}
              isDrawer={true}
              refreshToken={refreshVersion}
              onClose={closeMessageDrawer}
              onSelectMessage={(id) => openMessageDrawer(id)}
              onTriggerAction={triggerAction}
              onOpenPivotLogs={openPivotLogs}
            />
          </div>
        </div>
      )}

      {/* Action Modals */}
      <OperatorPromptModal
        isOpen={operatorPromptOpen}
        onSave={handleOperatorPromptSubmit}
        onCancel={handleOperatorPromptCancel}
      />

      {confirmDialogState && (
        <ConfirmActionDialog
          isOpen={confirmDialogState.isOpen}
          actionType={confirmDialogState.type}
          messages={confirmDialogState.messages}
          config={config}
          isSubmitting={isSubmittingAction}
          onConfirm={executeConfirmedAction}
          onCancel={cancelActionModals}
        />
      )}

      {editRetryState && (
        <EditRetryModal
          isOpen={editRetryState.isOpen}
          message={editRetryState.detail}
          config={config}
          isSubmitting={isSubmittingAction}
          onSubmit={executeEditRetryAction}
          onCancel={cancelActionModals}
        />
      )}

      <PivotLogsModal filter={pivotLogFilter} onClose={closePivotLogs} />

      {/* Action Result Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              data-testid="action-toast"
              className="pointer-events-auto p-4 rounded-lg border border-border-strong bg-surface shadow-lg flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 text-xs">
                {t.isError || t.failures.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-brand-purple shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2
                    className="w-4 h-4 shrink-0 mt-0.5"
                    style={{ color: "var(--status-success-text)" }}
                  />
                )}
                <div className="space-y-1">
                  <div className="font-semibold text-text-primary">
                    {t.title}
                  </div>
                  <div className="text-text-secondary font-mono">
                    Accepted: {t.accepted} / {t.requested}
                  </div>
                  {t.failures.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[11px] font-mono text-text-secondary">
                      {t.failures.map((f, i) => (
                        <li key={i}>
                          • {f.id}: {f.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="p-1 rounded hover:bg-surface-hover text-text-muted cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
