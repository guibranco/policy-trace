import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, GitBranch, RefreshCw } from "lucide-react";
import { getConversation } from "../api/client";
import { ConversationGraph } from "../api/types";
import { CopyButton, ErrorState, SkeletonRows } from "../components/Common";
import { ConversationDiagram } from "../components/ConversationDiagram";
import { useAppContext } from "../context/AppContext";
import { extractProblemDetails } from "../utils/format";

export const ConversationPage: React.FC = () => {
  const { conversationId = "" } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { openMessageDrawer, refreshVersion } = useAppContext();

  const [graph, setGraph] = useState<ConversationGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof extractProblemDetails> | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const g = await getConversation(conversationId);
      setGraph(g);
    } catch (e) {
      setError(extractProblemDetails(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [conversationId, refreshVersion]);

  return (
    <div className="p-5 max-w-[1600px] mx-auto space-y-4">
      {/* Top Bar with Back Link and Title */}
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
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-brand-purple" />
            <h1 className="text-base font-bold font-mono text-text-primary">
              {conversationId}
            </h1>
            <CopyButton value={conversationId} label="Copy ID" />
          </div>
        </div>

        <button
          type="button"
          onClick={fetchGraph}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface hover:bg-surface-hover text-text-primary cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload Graph</span>
        </button>
      </div>

      {loading ? (
        <SkeletonRows count={8} height="h-20" />
      ) : error ? (
        <ErrorState problem={error} onRetry={fetchGraph} />
      ) : graph ? (
        <ConversationDiagram
          graph={graph}
          onSelectMessage={(id) => openMessageDrawer(id)}
          onSelectSaga={(sId) => navigate(`/sagas/${sId}`)}
          heightClass="h-[750px]"
        />
      ) : null}
    </div>
  );
};
