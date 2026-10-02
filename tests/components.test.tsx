import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  StatusBadge,
  LogLevelBadge,
  EnvironmentBadge,
  CopyButton,
  TimestampCell,
  ErrorState,
  EmptyState,
  SkeletonRows,
} from "../src/components/Common";
import {
  RelatedTicketsPanel,
  TicketCard,
} from "../src/components/RelatedTicketsPanel";
import { RelatedTicket, RelatedTicketsResult } from "../src/api/types";

describe("Common Components", () => {
  describe("StatusBadge", () => {
    it("renders all message statuses correctly", () => {
      const { rerender } = render(<StatusBadge status="successful" />);
      expect(screen.getByText("Successful")).toBeInTheDocument();

      rerender(<StatusBadge status="failed" />);
      expect(screen.getByText("Failed")).toBeInTheDocument();

      rerender(<StatusBadge status="repeatedFailure" />);
      expect(screen.getByText("Repeated failure")).toBeInTheDocument();

      rerender(<StatusBadge status="retryIssued" />);
      expect(screen.getByText("Retry issued")).toBeInTheDocument();

      rerender(<StatusBadge status="resolved" />);
      expect(screen.getByText("Resolved")).toBeInTheDocument();

      rerender(<StatusBadge status="archived" />);
      expect(screen.getByText("Archived")).toBeInTheDocument();
    });
  });

  describe("LogLevelBadge", () => {
    it("renders correct level badges", () => {
      const { rerender } = render(<LogLevelBadge level="Fatal" />);
      expect(screen.getByText("FTL")).toBeInTheDocument();

      rerender(<LogLevelBadge level="Error" />);
      expect(screen.getByText("ERR")).toBeInTheDocument();

      rerender(<LogLevelBadge level="Warning" />);
      expect(screen.getByText("WRN")).toBeInTheDocument();

      rerender(<LogLevelBadge level="Information" />);
      expect(screen.getByText("INF")).toBeInTheDocument();

      rerender(<LogLevelBadge level="Debug" />);
      expect(screen.getByText("DBG")).toBeInTheDocument();

      rerender(<LogLevelBadge level="Verbose" />);
      expect(screen.getByText("VRB")).toBeInTheDocument();
    });
  });

  describe("EnvironmentBadge", () => {
    it("renders environment name with data-testid", () => {
      const { rerender } = render(<EnvironmentBadge env="INT" />);
      expect(screen.getByTestId("environment-badge")).toHaveTextContent("INT");

      rerender(<EnvironmentBadge env="PROD" />);
      expect(screen.getByTestId("environment-badge")).toHaveTextContent("PROD");
    });
  });

  describe("CopyButton", () => {
    it("copies text to clipboard and shows feedback", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(<CopyButton value="OUTINT00118618" label="Copy ID" />);
      const btn = screen.getByRole("button");
      fireEvent.click(btn);

      expect(writeTextMock).toHaveBeenCalledWith("OUTINT00118618");
      expect(await screen.findByText("Copied")).toBeInTheDocument();
    });
  });

  describe("TimestampCell", () => {
    it("renders formatted timestamp", () => {
      render(<TimestampCell iso="2026-10-02T13:15:00.000Z" />);
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it("renders dash for null timestamp", () => {
      render(<TimestampCell iso={null} />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe("ErrorState", () => {
    it("renders title, detail and calls onRetry when clicked", () => {
      const onRetry = vi.fn();
      render(
        <ErrorState
          problem={{
            title: "Connection Lost",
            detail: "Seq server unreachable",
            status: 503,
          }}
          onRetry={onRetry}
        />
      );

      expect(screen.getByText("Connection Lost")).toBeInTheDocument();
      expect(screen.getByText("Seq server unreachable")).toBeInTheDocument();
      expect(screen.getByText("(HTTP 503)")).toBeInTheDocument();

      const retryBtn = screen.getByTestId("error-retry-button");
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("EmptyState", () => {
    it("renders title and description", () => {
      render(
        <EmptyState
          title="No results found"
          description="Try relaxing your filters."
        />
      );
      expect(screen.getByText("No results found")).toBeInTheDocument();
      expect(
        screen.getByText("Try relaxing your filters.")
      ).toBeInTheDocument();
    });
  });

  describe("SkeletonRows", () => {
    it("renders skeleton rows", () => {
      render(<SkeletonRows count={4} />);
      expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
    });
  });
});

describe("RelatedTicketsPanel", () => {
  const sampleTicket: RelatedTicket = {
    relation: "matchesError",
    hint: "possibleCause",
    reason: "Caused by strict Cosmos ETag checks",
    ticket: {
      key: "CORE-1234",
      summary: "Fix optimistic concurrency",
      issueType: "Bug",
      status: "Done",
      statusCategory: "done",
      priority: "High",
      assignee: "Marek Nowak",
      components: ["policy-admin"],
      labels: ["cosmos"],
      fixVersions: ["2026.10"],
      created: "2026-10-01T10:00:00.000Z",
      updated: "2026-10-02T10:00:00.000Z",
      resolved: "2026-10-02T11:00:00.000Z",
      url: "https://jira.stratos-insure.internal/browse/CORE-1234",
      excerpt: "...ETag check failed on ExpireSoftLockCommand...",
    },
  };

  it("renders ticket card with details and matched term highlights", () => {
    render(
      <TicketCard
        item={sampleTicket}
        highlightTerms={["ExpireSoftLockCommand"]}
      />
    );
    expect(screen.getByText("CORE-1234")).toBeInTheDocument();
    expect(screen.getByText("Fix optimistic concurrency")).toBeInTheDocument();
    expect(
      screen.getByText("Caused by strict Cosmos ETag checks")
    ).toBeInTheDocument();
    expect(screen.getByText("Marek Nowak")).toBeInTheDocument();
  });

  it("renders RelatedTicketsPanel with groups and timeline toggle", () => {
    const result: RelatedTicketsResult = {
      enabled: true,
      ok: true,
      error: null,
      tickets: [
        sampleTicket,
        {
          ...sampleTicket,
          hint: "possibleFix",
          ticket: { ...sampleTicket.ticket, key: "CORE-1289" },
        },
      ],
      truncated: false,
    };

    const onToggleTimeline = vi.fn();
    render(
      <RelatedTicketsPanel
        result={result}
        loading={false}
        onRetry={() => {}}
        showOnTimeline={false}
        onToggleShowOnTimeline={onToggleTimeline}
      />
    );

    expect(screen.getByTestId("related-tickets-panel")).toBeInTheDocument();
    expect(screen.getByText("Possible causes")).toBeInTheDocument();
    expect(screen.getByText("Possible fixes")).toBeInTheDocument();

    const toggle = screen.getByTestId("show-tickets-on-timeline-toggle");
    fireEvent.click(toggle);
    expect(onToggleTimeline).toHaveBeenCalled();
  });

  it("renders Jira error state when ok is false", () => {
    const onRetry = vi.fn();
    const result: RelatedTicketsResult = {
      enabled: true,
      ok: false,
      error: "Jira gateway timeout",
      tickets: [],
      truncated: false,
    };

    render(
      <RelatedTicketsPanel
        result={result}
        loading={false}
        onRetry={onRetry}
      />
    );

    expect(screen.getByTestId("jira-error-banner")).toBeInTheDocument();
    expect(screen.getByText("Jira gateway timeout")).toBeInTheDocument();

    const retryBtn = screen.getByTestId("jira-retry-button");
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
