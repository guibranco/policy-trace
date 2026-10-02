import React, { useMemo, useState } from "react";
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import {
  ArrowRight,
  CornerUpLeft,
  GitBranch,
  Layers,
  Radio,
  Send,
  Workflow,
} from "lucide-react";
import { type ConversationGraph, type MessageStatus } from "../api/types";
import { formatShortTime, shortTypeName } from "../utils/format";
import { StatusBadge } from "./Common";

interface FlowNodeData extends Record<string, unknown> {
  id: string;
  messageId: string;
  messageType: string;
  intent: "send" | "publish" | "reply" | "unknown";
  status: MessageStatus;
  sendingEndpoint: string | null;
  receivingEndpoint: string | null;
  timeSent: string | null;
  sagaIds: string[];
  isHighlighted: boolean;
  onSelectMessage: (id: string) => void;
  onSelectSaga: (sagaId: string) => void;
}

const IntentIcon: React.FC<{
  intent: "send" | "publish" | "reply" | "unknown";
}> = ({ intent }) => {
  if (intent === "publish") {
    return (
      <span title="Publish event" className="inline-flex items-center">
        <Radio className="w-3.5 h-3.5 text-text-secondary" />
      </span>
    );
  }
  if (intent === "reply") {
    return (
      <span title="Reply message" className="inline-flex items-center">
        <CornerUpLeft className="w-3.5 h-3.5 text-text-secondary" />
      </span>
    );
  }
  return (
    <span title="Send command" className="inline-flex items-center">
      <Send className="w-3.5 h-3.5 text-text-secondary" />
    </span>
  );
};

function getStatusAccentStyle(status: MessageStatus): React.CSSProperties {
  switch (status) {
    case "successful":
    case "resolved":
      return {
        borderLeftWidth: "4px",
        borderLeftColor: "var(--status-success-text)",
      };
    case "failed":
    case "repeatedFailure":
      return {
        borderLeftWidth: "4px",
        borderLeftColor: "var(--status-failed-text)",
      };
    case "retryIssued":
      return {
        borderLeftWidth: "4px",
        borderLeftColor: "var(--status-retry-text)",
      };
    case "archived":
      return {
        borderLeftWidth: "4px",
        borderLeftColor: "var(--status-archived-text)",
      };
  }
}

const MessageFlowNodeComponent: React.FC<NodeProps<Node<FlowNodeData>>> = ({
  data,
}) => {
  const shortName = shortTypeName(data.messageType);

  return (
    <div
      data-testid={`flow-node-${data.id}`}
      onClick={() => data.onSelectMessage(data.id)}
      style={{
        ...getStatusAccentStyle(data.status),
        ...(data.isHighlighted
          ? {
              outline: "3px solid var(--brand-lime)",
              outlineOffset: "2px",
            }
          : {}),
      }}
      className="w-[260px] rounded-lg border border-border-strong bg-surface shadow-sm hover:border-brand-purple transition-colors p-3 cursor-pointer text-left select-none"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-border-strong !w-2 !h-2"
      />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <IntentIcon intent={data.intent} />
          <span
            title={data.messageType}
            className="font-mono text-xs font-semibold text-text-primary truncate"
          >
            {shortName}
          </span>
        </div>

        {data.sagaIds.length > 0 && (
          <button
            type="button"
            data-testid={`flow-node-saga-${data.sagaIds[0]}`}
            onClick={(e) => {
              e.stopPropagation();
              data.onSelectSaga(data.sagaIds[0]);
            }}
            title={`Inspect Saga: ${data.sagaIds[0]}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0 cursor-pointer"
            style={{
              backgroundColor: "var(--brand-lime)",
              color: "var(--text-on-lime)",
            }}
          >
            <Workflow className="w-3 h-3" />
            <span>Saga</span>
          </button>
        )}
      </div>

      <div className="text-[11px] font-mono text-text-secondary truncate mb-2">
        <span className="text-text-muted">to </span>
        <span className="font-medium text-text-primary">
          {data.receivingEndpoint || "unknown"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border-subtle">
        <StatusBadge status={data.status} size="sm" />
        <span className="font-mono text-[11px] text-text-muted tabular-nums">
          {formatShortTime(data.timeSent)}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-border-strong !w-2 !h-2"
      />
    </div>
  );
};

const nodeTypes = {
  messageNode: MessageFlowNodeComponent,
};

export const ConversationDiagram: React.FC<{
  graph: ConversationGraph;
  highlightMessageId?: string | null;
  onSelectMessage: (id: string) => void;
  onSelectSaga: (sagaId: string) => void;
  heightClass?: string;
}> = ({
  graph,
  highlightMessageId,
  onSelectMessage,
  onSelectSaga,
  heightClass = "h-[600px]",
}) => {
  const [viewMode, setViewMode] = useState<"flow" | "sequence">("flow");

  // Compute top-to-bottom tree layout from graph.nodes and graph.edges
  const { rfNodes, rfEdges } = useMemo(() => {
    const childrenMap = new Map<string, string[]>();
    const incomingCount = new Map<string, number>();

    for (const n of graph.nodes) {
      childrenMap.set(n.id, []);
      incomingCount.set(n.id, 0);
    }
    for (const e of graph.edges) {
      if (childrenMap.has(e.from) && incomingCount.has(e.to)) {
        childrenMap.get(e.from)!.push(e.to);
        incomingCount.set(e.to, (incomingCount.get(e.to) || 0) + 1);
      }
    }

    const roots = graph.nodes
      .filter((n) => (incomingCount.get(n.id) || 0) === 0)
      .map((n) => n.id);
    if (roots.length === 0 && graph.nodes.length > 0) {
      roots.push(graph.nodes[0].id);
    }

    const levels = new Map<string, number>();
    const queue: Array<{ id: string; level: number }> = roots.map((r) => ({
      id: r,
      level: 0,
    }));

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (levels.has(curr.id)) continue;
      levels.set(curr.id, curr.level);
      const kids = childrenMap.get(curr.id) || [];
      for (const k of kids) {
        if (!levels.has(k)) {
          queue.push({ id: k, level: curr.level + 1 });
        }
      }
    }

    // Any disconnected node gets placed at bottom
    for (const n of graph.nodes) {
      if (!levels.has(n.id)) {
        levels.set(n.id, 0);
      }
    }

    const byLevel = new Map<number, typeof graph.nodes>();
    for (const n of graph.nodes) {
      const lvl = levels.get(n.id) || 0;
      if (!byLevel.has(lvl)) byLevel.set(lvl, []);
      byLevel.get(lvl)!.push(n);
    }

    const NODE_WIDTH = 300;
    const NODE_HEIGHT = 155;

    const nodesOut: Node<FlowNodeData>[] = [];
    for (const [lvl, list] of byLevel.entries()) {
      const totalWidth = (list.length - 1) * NODE_WIDTH;
      list.forEach((n, idx) => {
        const x = idx * NODE_WIDTH - totalWidth / 2;
        const y = lvl * NODE_HEIGHT;
        const isHighlighted =
          highlightMessageId === n.id || highlightMessageId === n.messageId;

        nodesOut.push({
          id: n.id,
          type: "messageNode",
          position: { x, y },
          data: {
            ...n,
            isHighlighted,
            onSelectMessage,
            onSelectSaga,
          },
        });
      });
    }

    const edgesOut: Edge[] = graph.edges.map((e, idx) => ({
      id: `edge-${e.from}-${e.to}-${idx}`,
      source: e.from,
      target: e.to,
      type: "smoothstep",
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
      },
      style: {
        strokeWidth: 1.75,
        stroke: "var(--border-strong)",
      },
    }));

    return { rfNodes: nodesOut, rfEdges: edgesOut };
  }, [graph, highlightMessageId, onSelectMessage, onSelectSaga]);

  // Sequence view lanes & ordered messages
  const sequenceData = useMemo(() => {
    const endpointsSet = new Set<string>();
    for (const n of graph.nodes) {
      if (n.sendingEndpoint) endpointsSet.add(n.sendingEndpoint);
      if (n.receivingEndpoint) endpointsSet.add(n.receivingEndpoint);
    }
    const lanes = Array.from(endpointsSet);
    if (lanes.length === 0) lanes.push("policy-admin");

    const sortedNodes = [...graph.nodes].sort(
      (a, b) =>
        new Date(a.timeSent || 0).getTime() -
        new Date(b.timeSent || 0).getTime()
    );

    return { lanes, sortedNodes };
  }, [graph]);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-subtle flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-text-primary">
            Conversation Diagram
          </span>
          <span className="text-text-muted">·</span>
          <span className="font-mono text-text-secondary">
            {graph.conversationId}
          </span>
          <span className="text-text-muted">·</span>
          <span className="font-mono text-text-muted tabular-nums">
            {graph.nodes.length} messages
          </span>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded border border-border-strong bg-surface text-xs">
          <button
            type="button"
            data-testid="diagram-view-flow"
            onClick={() => setViewMode("flow")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
              viewMode === "flow"
                ? "bg-brand-purple text-text-on-purple"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Flow Tree</span>
          </button>
          <button
            type="button"
            data-testid="diagram-view-sequence"
            onClick={() => setViewMode("sequence")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
              viewMode === "sequence"
                ? "bg-brand-purple text-text-on-purple"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sequence</span>
          </button>
        </div>
      </div>

      {/* Canvas */}
      {viewMode === "flow" ? (
        <div
          data-testid="flow-diagram-canvas"
          className={`w-full ${heightClass} bg-bg relative`}
        >
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.3}
            maxZoom={1.6}
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              className="!bg-surface !border !border-border-strong !rounded"
            />
          </ReactFlow>
        </div>
      ) : (
        /* Sequence Diagram View: Endpoints as vertical lanes and messages as arrows in time order */
        <div
          data-testid="sequence-diagram-canvas"
          className={`w-full ${heightClass} overflow-auto p-6 bg-bg`}
        >
          <div
            className="min-w-[680px] relative mx-auto"
            style={{
              maxWidth: `${Math.max(720, sequenceData.lanes.length * 240)}px`,
            }}
          >
            {/* Endpoint Column Headers */}
            <div
              className="grid gap-4 pb-4 border-b border-border-strong sticky top-0 bg-bg z-10"
              style={{
                gridTemplateColumns: `repeat(${sequenceData.lanes.length}, minmax(180px, 1fr))`,
              }}
            >
              {sequenceData.lanes.map((ep) => (
                <div key={ep} className="text-center">
                  <div className="inline-block px-3 py-1.5 rounded border border-border-strong bg-surface font-mono text-xs font-semibold text-text-primary shadow-xs">
                    {ep}
                  </div>
                </div>
              ))}
            </div>

            {/* Vertical Lane Lifelines */}
            <div className="relative pt-4 pb-8 space-y-4">
              <div
                className="absolute inset-0 pointer-events-none grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${sequenceData.lanes.length}, minmax(180px, 1fr))`,
                }}
              >
                {sequenceData.lanes.map((ep) => (
                  <div key={ep} className="flex justify-center h-full">
                    <div className="w-px h-full border-l border-dashed border-border-strong" />
                  </div>
                ))}
              </div>

              {/* Message Rows in Time Order */}
              {sequenceData.sortedNodes.map((node, idx) => {
                const fromIdx = Math.max(
                  0,
                  sequenceData.lanes.indexOf(
                    node.sendingEndpoint || sequenceData.lanes[0]
                  )
                );
                const toIdx = Math.max(
                  0,
                  sequenceData.lanes.indexOf(
                    node.receivingEndpoint || sequenceData.lanes[0]
                  )
                );
                const isSelf = fromIdx === toIdx;
                const isHighlighted =
                  highlightMessageId === node.id ||
                  highlightMessageId === node.messageId;

                const laneCount = sequenceData.lanes.length;
                const leftPct =
                  ((Math.min(fromIdx, toIdx) + 0.5) / laneCount) * 100;
                const rightPct =
                  ((Math.max(fromIdx, toIdx) + 0.5) / laneCount) * 100;
                const widthPct = Math.max(14, rightPct - leftPct);

                return (
                  <div
                    key={node.id}
                    data-testid={`sequence-node-${node.id}`}
                    onClick={() => onSelectMessage(node.id)}
                    className="relative z-10 py-2 cursor-pointer group"
                  >
                    <div
                      style={{
                        marginLeft: isSelf
                          ? `calc(${leftPct}% - 110px)`
                          : `${leftPct}%`,
                        width: isSelf ? "220px" : `${widthPct}%`,
                        ...(isHighlighted
                          ? {
                              outline: "3px solid var(--brand-lime)",
                              outlineOffset: "2px",
                            }
                          : {}),
                      }}
                      className="p-2.5 rounded-lg border border-border-strong bg-surface group-hover:border-brand-purple shadow-xs transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-mono text-[11px] text-text-muted tabular-nums">
                          #{idx + 1} · {formatShortTime(node.timeSent)}
                        </span>
                        <StatusBadge status={node.status} size="sm" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <IntentIcon intent={node.intent} />
                          <span
                            className="font-mono text-xs font-semibold text-text-primary truncate"
                            title={node.messageType}
                          >
                            {shortTypeName(node.messageType)}
                          </span>
                        </div>
                        {node.sagaIds.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSaga(node.sagaIds[0]);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer shrink-0"
                            style={{
                              backgroundColor: "var(--brand-lime)",
                              color: "var(--text-on-lime)",
                            }}
                          >
                            Saga
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono text-text-secondary">
                        <span>{node.sendingEndpoint || "—"}</span>
                        <ArrowRight className="w-3 h-3 text-brand-purple shrink-0" />
                        <span>{node.receivingEndpoint || "—"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
