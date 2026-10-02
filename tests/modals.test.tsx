import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  OperatorPromptModal,
  ConfirmActionDialog,
  EditRetryModal,
} from "../src/components/ActionModals";
import { type AppConfig, type MessageDetail, type MessageSummary } from "../src/api/types";

const mockConfig: AppConfig = {
  environmentName: "INT",
  seqPublicUrl: "https://seq.test",
  servicePulsePublicUrl: "https://pulse.test",
  actions: { retry: true, archive: true, edit: true, maxBatchSize: 5 },
  defaultLookbackDays: 7,
  policyNumberPattern: "^OUTINT\\d{8}$",
  jira: { enabled: true, baseUrl: "https://jira.test" },
};

const sampleMessage: MessageSummary = {
  id: "msg-1",
  messageId: "11111111-1111-1111-1111-111111111111",
  messageType: "Stratos.Commands.ExpireSoftLockCommand",
  status: "failed",
  sendingEndpoint: "policy-admin",
  receivingEndpoint: "policy-admin",
  timeSent: "2026-10-02T12:00:00.000Z",
  processedAt: "2026-10-02T12:00:01.000Z",
  conversationId: "conv-1",
  sagaIds: [],
  exceptionType: "System.Exception",
  exceptionMessage: "Failed",
  numberOfProcessingAttempts: 5,
  servicePulseUrl: null,
};

const sampleDetail: MessageDetail = {
  ...sampleMessage,
  headers: {
    "NServiceBus.MessageId": "11111111-1111-1111-1111-111111111111",
    "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
    "x-custom-header": "test-value",
  },
  body: JSON.stringify({ policyNumber: "OUTINT00118618", version: 1 }),
  bodyContentType: "application/json",
  bodyEditable: true,
  lockedHeaders: ["NServiceBus.MessageId", "Cosmos.CosmosPartitionKeyValue"],
  stackTrace: "at handler()",
};

describe("Action Modals", () => {
  describe("OperatorPromptModal", () => {
    it("renders and accepts operator name", () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <OperatorPromptModal isOpen={true} onSave={onSave} onCancel={onCancel} />
      );

      expect(screen.getByTestId("operator-prompt-dialog")).toBeInTheDocument();
      const input = screen.getByTestId("operator-prompt-input");
      fireEvent.change(input, { target: { value: "j.kovacs" } });

      const submitBtn = screen.getByTestId("operator-prompt-submit");
      fireEvent.click(submitBtn);

      expect(onSave).toHaveBeenCalledWith("j.kovacs");
    });
  });

  describe("ConfirmActionDialog", () => {
    it("renders message counts and confirms retry", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <ConfirmActionDialog
          isOpen={true}
          actionType="retry"
          messages={[sampleMessage]}
          config={mockConfig}
          isSubmitting={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(screen.getByTestId("confirm-action-dialog")).toBeInTheDocument();
      expect(screen.getByText("ExpireSoftLockCommand")).toBeInTheDocument();

      const submitBtn = screen.getByTestId("confirm-dialog-submit");
      fireEvent.click(submitBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("enforces maxBatchSize limit warning", () => {
      const sixMessages = Array.from({ length: 6 }, (_, i) => ({
        ...sampleMessage,
        id: `msg-${i}`,
      }));

      render(
        <ConfirmActionDialog
          isOpen={true}
          actionType="retry"
          messages={sixMessages}
          config={mockConfig}
          isSubmitting={false}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId("batch-limit-warning")).toBeInTheDocument();
      const submitBtn = screen.getByTestId("confirm-dialog-submit");
      expect(submitBtn).toBeDisabled();
    });

    it("requires typing PROD when environmentName is PROD", () => {
      const prodConfig: AppConfig = {
        ...mockConfig,
        environmentName: "PROD",
      };

      const onConfirm = vi.fn();
      render(
        <ConfirmActionDialog
          isOpen={true}
          actionType="retry"
          messages={[sampleMessage]}
          config={prodConfig}
          isSubmitting={false}
          onConfirm={onConfirm}
          onCancel={() => {}}
        />
      );

      const submitBtn = screen.getByTestId("confirm-dialog-submit");
      expect(submitBtn).toBeDisabled();

      const prodInput = screen.getByTestId("prod-confirm-input");
      fireEvent.change(prodInput, { target: { value: "PROD" } });

      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe("EditRetryModal", () => {
    it("validates JSON body and prevents submission on invalid JSON", () => {
      render(
        <EditRetryModal
          isOpen={true}
          message={sampleDetail}
          config={mockConfig}
          isSubmitting={false}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId("edit-retry-dialog")).toBeInTheDocument();
      const bodyInput = screen.getByTestId("edit-retry-body-input");

      // Enter invalid JSON
      fireEvent.change(bodyInput, { target: { value: "{ invalid json" } });

      expect(screen.getByTestId("edit-retry-json-error")).toBeInTheDocument();
      expect(screen.getByTestId("edit-retry-review-button")).toBeDisabled();
    });

    it("renders locked headers as read-only and allows editing unlocked headers", () => {
      render(
        <EditRetryModal
          isOpen={true}
          message={sampleDetail}
          config={mockConfig}
          isSubmitting={false}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      const lockedHeaderInput = screen.getByTestId(
        "header-input-NServiceBus.MessageId"
      );
      expect(lockedHeaderInput).toHaveAttribute("readonly");

      const editableHeaderInput = screen.getByTestId(
        "header-input-x-custom-header"
      );
      expect(editableHeaderInput).not.toHaveAttribute("readonly");
      fireEvent.change(editableHeaderInput, {
        target: { value: "updated-val" },
      });
      expect(editableHeaderInput).toHaveValue("updated-val");
    });

    it("navigates to side-by-side diff view and submits", () => {
      const onSubmit = vi.fn();
      render(
        <EditRetryModal
          isOpen={true}
          message={sampleDetail}
          config={mockConfig}
          isSubmitting={false}
          onSubmit={onSubmit}
          onCancel={() => {}}
        />
      );

      const reviewBtn = screen.getByTestId("edit-retry-review-button");
      fireEvent.click(reviewBtn);

      expect(screen.getByTestId("edit-retry-diff-view")).toBeInTheDocument();
      const finalSubmit = screen.getByTestId("edit-retry-submit-button");
      fireEvent.click(finalSubmit);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
