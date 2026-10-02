import { createContext, useContext } from "react";
import {
  type AppConfig,
  type MessageDetail,
  type MessageSummary,
} from "../api/types";

export interface ToastNotice {
  id: string;
  title: string;
  accepted: number;
  requested: number;
  failures: Array<{ id: string; reason: string }>;
  isError?: boolean;
}

export interface AppContextValue {
  config: AppConfig;
  endpoints: string[];
  operatorName: string;
  updateOperatorName: (name: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  drawerMessageId: string | null;
  openMessageDrawer: (id: string) => void;
  closeMessageDrawer: () => void;
  pivotLogFilter: { requestId?: string; sessionId?: string } | null;
  openPivotLogs: (filter: { requestId?: string; sessionId?: string }) => void;
  closePivotLogs: () => void;
  triggerAction: (
    type: "retry" | "archive" | "unarchive" | "editRetry",
    messages: MessageSummary[],
    detail?: MessageDetail
  ) => void;
  refreshVersion: number;
  notifyDataChanged: () => void;
  toasts: ToastNotice[];
  dismissToast: (id: string) => void;
  // Modal states exposed for AppShell
  operatorPromptOpen: boolean;
  handleOperatorPromptSubmit: (name: string) => void;
  handleOperatorPromptCancel: () => void;
  confirmDialogState: {
    isOpen: boolean;
    type: "retry" | "archive" | "unarchive";
    messages: MessageSummary[];
  } | null;
  editRetryState: {
    isOpen: boolean;
    detail: MessageDetail;
  } | null;
  isSubmittingAction: boolean;
  executeConfirmedAction: () => Promise<void>;
  executeEditRetryAction: (
    id: string,
    body: string,
    headers: Record<string, string>
  ) => Promise<void>;
  cancelActionModals: () => void;
}

// Lives outside AppContext.tsx so that file only exports components, which
// keeps React Fast Refresh working for the provider.
export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider");
  return ctx;
}
