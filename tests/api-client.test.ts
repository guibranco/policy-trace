import { describe, it, expect, beforeEach } from "vitest";
import {
  getConfig,
  getEndpoints,
  lookupPolicy,
  getMessages,
  getMessage,
  getConversation,
  getSaga,
  getRelatedTickets,
  getLogs,
  retryMessage,
  retryMessages,
  archiveMessage,
  archiveMessages,
  unarchiveMessage,
  editAndRetryMessage,
  getOperatorName,
  setOperatorName,
  USE_MOCK,
} from "../src/api/client";

describe("API Client & Mock Backend", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports USE_MOCK flag", () => {
    expect(USE_MOCK).toBe(true);
  });

  describe("Operator storage", () => {
    it("reads and writes operator name in localStorage", () => {
      expect(getOperatorName()).toBe("");
      setOperatorName("j.kovacs");
      expect(getOperatorName()).toBe("j.kovacs");
    });
  });

  describe("getConfig", () => {
    it("returns valid AppConfig", async () => {
      const config = await getConfig();
      expect(config.environmentName).toBe("INT");
      expect(config.policyNumberPattern).toBe("^OUTINT\\d{8}$");
      expect(config.actions.retry).toBe(true);
      expect(config.actions.archive).toBe(true);
      expect(config.actions.edit).toBe(true);
      expect(config.actions.maxBatchSize).toBe(5);
    });
  });

  describe("getEndpoints", () => {
    it("returns list of NServiceBus endpoints", async () => {
      const endpoints = await getEndpoints();
      expect(endpoints).toContain("policy-admin");
      expect(endpoints).toContain("policy-admin-api");
    });
  });

  describe("lookupPolicy", () => {
    it("returns lookup result for main policy OUTINT00118618 with ~40 items and 3 conversations", async () => {
      const res = await lookupPolicy("OUTINT00118618");
      expect(res.policyNumber).toBe("OUTINT00118618");
      expect(res.conversationIds).toHaveLength(3);
      expect(res.items.length).toBeGreaterThanOrEqual(35);
      expect(res.sources.seq.ok).toBe(true);
      expect(res.sources.serviceControl.ok).toBe(true);
      expect(res.hiddenNoiseCount).toBe(14);
    });

    it("includes framework noise when includeNoise is true", async () => {
      const resWithNoise = await lookupPolicy("OUTINT00118618", {
        includeNoise: true,
      });
      const resWithoutNoise = await lookupPolicy("OUTINT00118618", {
        includeNoise: false,
      });
      expect(resWithNoise.items.length).toBeGreaterThan(
        resWithoutNoise.items.length
      );
    });

    it("handles policy with truncated logs (OUTINT00229401)", async () => {
      const res = await lookupPolicy("OUTINT00229401");
      expect(res.truncated.logs).toBe(true);
    });

    it("handles partial source failure when Seq is offline (OUTINT00334512)", async () => {
      const res = await lookupPolicy("OUTINT00334512");
      expect(res.sources.seq.ok).toBe(false);
      expect(res.sources.seq.error).toContain("Seq query failed");
      expect(res.sources.serviceControl.ok).toBe(true);
      expect(res.items.length).toBeGreaterThan(0);
    });

    it("throws RFC 7807 problem details error on OUTINT00500500", async () => {
      await expect(lookupPolicy("OUTINT00500500")).rejects.toThrow();
    });

    it("returns empty result for unknown valid policy number", async () => {
      const res = await lookupPolicy("OUTINT00999999");
      expect(res.items).toHaveLength(0);
      expect(res.conversationIds).toHaveLength(0);
    });
  });

  describe("getMessages", () => {
    it("returns paged messages", async () => {
      const paged = await getMessages({ page: 1, pageSize: 5 });
      expect(paged.page).toBe(1);
      expect(paged.pageSize).toBe(5);
      expect(paged.items).toHaveLength(5);
      expect(paged.totalCount).toBeGreaterThan(5);
    });

    it("filters messages by endpoint and status", async () => {
      const paged = await getMessages({
        endpoint: "policy-admin",
        status: ["failed", "repeatedFailure"],
      });
      expect(
        paged.items.every(
          (m) =>
            m.receivingEndpoint === "policy-admin" ||
            m.sendingEndpoint === "policy-admin"
        )
      ).toBe(true);
      expect(
        paged.items.every(
          (m) => m.status === "failed" || m.status === "repeatedFailure"
        )
      ).toBe(true);
    });

    it("searches messages by query text", async () => {
      const paged = await getMessages({ q: "ExpireSoftLock" });
      expect(paged.items.length).toBeGreaterThan(0);
      expect(
        paged.items.every(
          (m) =>
            m.messageType.includes("ExpireSoftLock") ||
            (m.exceptionMessage &&
              m.exceptionMessage.includes("ExpireSoftLock"))
        )
      ).toBe(true);
    });
  });

  describe("getMessage detail", () => {
    it("returns message detail by ID with headers and body", async () => {
      const msg = await getMessage("msg-2937a3e5");
      expect(msg.id).toBe("msg-2937a3e5");
      expect(msg.headers).toBeDefined();
      expect(msg.body).toBeDefined();
      expect(msg.stackTrace).toContain("Microsoft.Azure.Cosmos.CosmosException");
      expect(msg.bodyEditable).toBe(true);
    });

    it("throws 404 for unknown message ID", async () => {
      await expect(getMessage("msg-nonexistent-999")).rejects.toThrow();
    });
  });

  describe("getConversation", () => {
    it("returns conversation graph with nodes and directed edges", async () => {
      const graph = await getConversation("conv-810a-4412-lock-workflow");
      expect(graph.conversationId).toBe("conv-810a-4412-lock-workflow");
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it("throws 404 for unknown conversation ID", async () => {
      await expect(getConversation("conv-nonexistent")).rejects.toThrow();
    });
  });

  describe("getSaga", () => {
    it("returns saga history with 5 steps including timeout", async () => {
      const saga = await getSaga("saga-9941a-softlock-00118618");
      expect(saga.sagaId).toBe("saga-9941a-softlock-00118618");
      expect(saga.changes).toHaveLength(5);
      const timeoutStep = saga.changes.find((c) =>
        c.initiatingMessage.isTimeout || c.outgoingMessages.some((m) => m.isTimeout)
      );
      expect(timeoutStep).toBeDefined();
    });

    it("throws 404 for unknown saga ID", async () => {
      await expect(getSaga("saga-nonexistent")).rejects.toThrow();
    });
  });

  describe("getRelatedTickets", () => {
    it("returns Jira tickets categorized into causes, fixes, and related", async () => {
      const res = await getRelatedTickets({ policyNumber: "OUTINT00118618" });
      expect(res.enabled).toBe(true);
      expect(res.ok).toBe(true);
      expect(res.tickets.length).toBeGreaterThanOrEqual(4);
      expect(res.tickets.some((t) => t.hint === "possibleCause")).toBe(true);
      expect(res.tickets.some((t) => t.hint === "possibleFix")).toBe(true);
    });

    it("returns error result for policy OUTINT00229401", async () => {
      const res = await getRelatedTickets({ policyNumber: "OUTINT00229401" });
      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe("getLogs", () => {
    it("filters logs by messageId, requestId, sessionId, or conversationId", async () => {
      const logs = await getLogs({ requestId: "req-lock-901a" });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every((l) => l.requestId === "req-lock-901a")).toBe(true);
    });
  });

  describe("Message Actions (retry, archive, unarchive, editRetry)", () => {
    it("retries a message successfully and updates status to retryIssued", async () => {
      const res = await retryMessage("msg-2937a3e5");
      expect(res.accepted).toBe(1);
      const updated = await getMessage("msg-2937a3e5");
      expect(updated.status).toBe("retryIssued");
    });

    it("bulk retries messages", async () => {
      const res = await retryMessages(["msg-9001e555", "msg-9002f666"]);
      expect(res.accepted).toBe(2);
      expect(res.requested).toBe(2);
    });

    it("archives and unarchives a message", async () => {
      const archiveRes = await archiveMessage("msg-9002f666");
      expect(archiveRes.accepted).toBe(1);
      let updated = await getMessage("msg-9002f666");
      expect(updated.status).toBe("archived");

      const unarchiveRes = await unarchiveMessage("msg-9002f666");
      expect(unarchiveRes.accepted).toBe(1);
      updated = await getMessage("msg-9002f666");
      expect(updated.status).toBe("failed");
    });

    it("bulk archives messages", async () => {
      const res = await archiveMessages(["msg-9001e555"]);
      expect(res.accepted).toBe(1);
    });

    it("edits and retries a message, marking original resolved and spawning replacement", async () => {
      const res = await editAndRetryMessage("msg-4404a2c3", {
        body: JSON.stringify({
          policyNumber: "OUTINT00118618",
          subRegionCode: "GB-ENG",
        }),
        headers: {
          "x-custom-operator": "test-suite",
        },
      });
      expect(res.accepted).toBe(1);
      const original = await getMessage("msg-4404a2c3");
      expect(original.status).toBe("retryIssued");
    });
  });
});
