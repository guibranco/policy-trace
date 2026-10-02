import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { MessageDetailView } from "../components/MessageDetailView";
import { useAppContext } from "../context/AppContext";

export const MessageDetailPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { config, triggerAction, refreshVersion, openPivotLogs } = useAppContext();

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface shadow-xs min-h-[700px] overflow-hidden">
        <MessageDetailView
          messageId={id}
          config={config}
          isDrawer={false}
          refreshToken={refreshVersion}
          onSelectMessage={(newId) => navigate(`/messages/${newId}`)}
          onTriggerAction={triggerAction}
          onOpenPivotLogs={openPivotLogs}
        />
      </div>
    </div>
  );
};
