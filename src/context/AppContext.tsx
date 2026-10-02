import React, { useCallback, useEffect, useState } from "react";
import {
  archiveMessage,
  archiveMessages,
  editAndRetryMessage,
  getConfig,
  getEndpoints,
  getMessage,
  getOperatorName,
  retryMessage,
  retryMessages,
  setOperatorName as saveOperatorName,
  unarchiveMessage,
} from "../api/client";
import {
  type ActionResult,
  type AppConfig,
  type MessageDetail,
  type MessageSummary,
} from "../api/types";
import { extractProblemDetails } from "../utils/format";
import { AppContext, type ToastNotice } from "./useAppContext";

export type { ToastNotice } from "./useAppContext";

interface PendingActionState {
  type: "retry" | "archive" | "unarchive" | "editRetry";
  messages: MessageSummary[];
  detail?: MessageDetail;
}

const DEFAULT_CONFIG: AppConfig = {
  environmentName: "INT",
  seqPublicUrl: "https://seq.int.stratos-insure.internal",
  servicePulsePublicUrl: "https://servicepulse.int.stratos-insure.internal",
  actions: {
    retry: true,
    archive: true,
    edit: true,
    maxBatchSize: 5,
  },
  defaultLookbackDays: 7,
  policyNumberPattern: "^OUTINT\\d{8}$",
  jira: {
    enabled: true,
    baseUrl: "https://jira.stratos-insure.internal",
  },
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [operatorName, setOperatorNameState] = useState<string>(() =>
    getOperatorName()
  );
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("policytrace_theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  const [drawerMessageId, setDrawerMessageId] = useState<string | null>(null);
  const [pivotLogFilter, setPivotLogFilter] = useState<{
    requestId?: string;
    sessionId?: string;
  } | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  // Action workflow states
  const [pendingAction, setPendingAction] =
    useState<PendingActionState | null>(null);
  const [operatorPromptOpen, setOperatorPromptOpen] = useState(false);
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    type: "retry" | "archive" | "unarchive";
    messages: MessageSummary[];
  } | null>(null);
  const [editRetryState, setEditRetryState] = useState<{
    isOpen: boolean;
    detail: MessageDetail;
  } | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch(() => {});
    getEndpoints()
      .then(setEndpoints)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("policytrace_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const updateOperatorName = useCallback((name: string) => {
    saveOperatorName(name);
    setOperatorNameState(name.trim());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const openMessageDrawer = useCallback((id: string) => {
    setDrawerMessageId(id);
  }, []);

  const closeMessageDrawer = useCallback(() => {
    setDrawerMessageId(null);
  }, []);

  const openPivotLogs = useCallback(
    (filter: { requestId?: string; sessionId?: string }) => {
      setPivotLogFilter(filter);
    },
    []
  );

  const closePivotLogs = useCallback(() => {
    setPivotLogFilter(null);
  }, []);

  const notifyDataChanged = useCallback(() => {
    setRefreshVersion((v) => v + 1);
  }, []);

  const addToast = useCallback((toast: Omit<ToastNotice, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Poll affected messages until status settles (e.g., retryIssued -> resolved)
  const startPollingMessages = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        notifyDataChanged();
        try {
          const details = await Promise.all(
            ids.map((id) => getMessage(id).catch(() => null))
          );
          const stillPending = details.some(
            (d) => d && d.status === "retryIssued"
          );
          if (!stillPending || attempts >= 5) {
            clearInterval(interval);
            notifyDataChanged();
          }
        } catch {
          if (attempts >= 5) clearInterval(interval);
        }
      }, 2000);
    },
    [notifyDataChanged]
  );

  const openSpecificModal = useCallback(async (action: PendingActionState) => {
    if (action.type === "editRetry") {
      let detail = action.detail;
      if (!detail && action.messages[0]) {
        try {
          detail = await getMessage(action.messages[0].id);
        } catch {
          return;
        }
      }
      if (detail) {
        setEditRetryState({ isOpen: true, detail });
      }
    } else {
      setConfirmDialogState({
        isOpen: true,
        type: action.type,
        messages: action.messages,
      });
    }
  }, []);

  const triggerAction = useCallback(
    (
      type: "retry" | "archive" | "unarchive" | "editRetry",
      messages: MessageSummary[],
      detail?: MessageDetail
    ) => {
      const nextAction: PendingActionState = { type, messages, detail };
      const currentOp = getOperatorName();
      if (!currentOp.trim()) {
        setPendingAction(nextAction);
        setOperatorPromptOpen(true);
        return;
      }
      void openSpecificModal(nextAction);
    },
    [openSpecificModal]
  );

  const handleOperatorPromptSubmit = useCallback(
    (name: string) => {
      updateOperatorName(name);
      setOperatorPromptOpen(false);
      if (pendingAction) {
        const act = pendingAction;
        setPendingAction(null);
        void openSpecificModal(act);
      }
    },
    [pendingAction, updateOperatorName, openSpecificModal]
  );

  const handleOperatorPromptCancel = useCallback(() => {
    setOperatorPromptOpen(false);
    setPendingAction(null);
  }, []);

  const cancelActionModals = useCallback(() => {
    setConfirmDialogState(null);
    setEditRetryState(null);
  }, []);

  const executeConfirmedAction = useCallback(async () => {
    if (!confirmDialogState) return;
    setIsSubmittingAction(true);
    const { type, messages } = confirmDialogState;
    const ids = messages.map((m) => m.id);

    try {
      let result: ActionResult;
      if (type === "retry") {
        result =
          ids.length === 1
            ? await retryMessage(ids[0])
            : await retryMessages(ids);
      } else if (type === "archive") {
        result =
          ids.length === 1
            ? await archiveMessage(ids[0])
            : await archiveMessages(ids);
      } else {
        result = await unarchiveMessage(ids[0]);
      }

      setConfirmDialogState(null);
      addToast({
        title:
          type === "retry"
            ? "Retry Queued"
            : type === "archive"
            ? "Messages Archived"
            : "Message Unarchived",
        accepted: result.accepted,
        requested: result.requested,
        failures: result.failures,
      });
      notifyDataChanged();
      if (type === "retry") {
        startPollingMessages(ids);
      }
    } catch (e) {
      const prob = extractProblemDetails(e);
      setConfirmDialogState(null);
      addToast({
        title: prob.title,
        accepted: 0,
        requested: ids.length,
        failures: [{ id: "Request", reason: prob.detail }],
        isError: true,
      });
    } finally {
      setIsSubmittingAction(false);
    }
  }, [confirmDialogState, addToast, notifyDataChanged, startPollingMessages]);

  const executeEditRetryAction = useCallback(
    async (id: string, body: string, headers: Record<string, string>) => {
      setIsSubmittingAction(true);
      try {
        const result = await editAndRetryMessage(id, { body, headers });
        setEditRetryState(null);
        addToast({
          title: "Edited Message Dispatched",
          accepted: result.accepted,
          requested: result.requested,
          failures: result.failures,
        });
        notifyDataChanged();
        startPollingMessages([id]);
      } catch (e) {
        const prob = extractProblemDetails(e);
        setEditRetryState(null);
        addToast({
          title: prob.title,
          accepted: 0,
          requested: 1,
          failures: [{ id, reason: prob.detail }],
          isError: true,
        });
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [addToast, notifyDataChanged, startPollingMessages]
  );

  return (
    <AppContext.Provider
      value={{
        config,
        endpoints,
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
        notifyDataChanged,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
