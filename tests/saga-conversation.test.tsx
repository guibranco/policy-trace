import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ConversationDiagram } from "../src/components/ConversationDiagram";
import { SagaPage } from "../src/pages/SagaPage";
import { AppProvider } from "../src/context/AppContext";
import { type ConversationGraph } from "../src/api/types";

const mockGraph: ConversationGraph = {
  conversationId: "conv-test-1",
  nodes: [
    {
      id: "node-1",
      messageId: "m-1",
      messageType: "Stratos.Commands.AcquireSoftLockCommand",
      intent: "send",
      status: "successful",
      sendingEndpoint: "policy-admin-api",
      receivingEndpoint: "policy-admin",
      timeSent: "2026-10-02T12:00:00.000Z",
      processedAt: "2026-10-02T12:00:01.000Z",
      sagaIds: ["saga-test-1"],
    },
    {
      id: "node-2",
      messageId: "m-2",
      messageType: "Stratos.Events.PolicySoftLockedEvent",
      intent: "publish",
      status: "successful",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "policy-admin-api",
      timeSent: "2026-10-02T12:00:02.000Z",
      processedAt: "2026-10-02T12:00:03.000Z",
      sagaIds: ["saga-test-1"],
    },
  ],
  edges: [{ from: "node-1", to: "node-2" }],
};

describe("Conversation & Saga Views", () => {
  describe("ConversationDiagram", () => {
    it("renders flow tree view and switches to sequence view", () => {
      const onSelectMessage = vi.fn();
      const onSelectSaga = vi.fn();

      render(
        <ConversationDiagram
          graph={mockGraph}
          onSelectMessage={onSelectMessage}
          onSelectSaga={onSelectSaga}
        />
      );

      expect(screen.getByTestId("diagram-view-flow")).toBeInTheDocument();
      expect(screen.getByTestId("diagram-view-sequence")).toBeInTheDocument();
      expect(screen.getByTestId("flow-diagram-canvas")).toBeInTheDocument();

      // Switch to sequence view
      fireEvent.click(screen.getByTestId("diagram-view-sequence"));
      expect(
        screen.getByTestId("sequence-diagram-canvas")
      ).toBeInTheDocument();

      // Node in sequence view
      expect(screen.getByTestId("sequence-node-node-1")).toBeInTheDocument();
    });
  });

  describe("SagaPage", () => {
    it("renders saga timeline steps and toggles state diff", async () => {
      render(
        <MemoryRouter
          initialEntries={["/sagas/saga-9941a-softlock-00118618"]}
        >
          <AppProvider>
            <Routes>
              <Route path="/sagas/:sagaId" element={<SagaPage />} />
            </Routes>
          </AppProvider>
        </MemoryRouter>
      );

      // Saga ID title
      expect(
        await screen.findByText("saga-9941a-softlock-00118618")
      ).toBeInTheDocument();

      // Steps
      expect(await screen.findByTestId("saga-step-0")).toBeInTheDocument();
      expect(screen.getByTestId("saga-step-1")).toBeInTheDocument();

      // Toggle step diff
      const expandBtn = screen.getByTestId("saga-step-expand-0");
      fireEvent.click(expandBtn);

      await waitFor(() => {
        expect(screen.getByTestId("saga-step-diff-0")).toBeInTheDocument();
      });
    });
  });
});
