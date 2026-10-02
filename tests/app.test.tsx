import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../src/App";

describe("PolicyTrace App Integration", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/policy/OUTINT00118618");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  it("renders top bar with search, environment badge, and navigation", async () => {
    render(<App />);

    expect(screen.getByText("PolicyTrace")).toBeInTheDocument();
    expect(screen.getByTestId("policy-search-input")).toBeInTheDocument();
    expect(screen.getByTestId("environment-badge")).toHaveTextContent("INT");

    // Nav links
    expect(screen.getByTestId("nav-policy-lookup")).toBeInTheDocument();
    expect(screen.getByTestId("nav-messages")).toBeInTheDocument();
    expect(screen.getByTestId("nav-failed-messages")).toBeInTheDocument();

    // Default policy heading loaded
    expect(await screen.findByTestId("policy-heading")).toHaveTextContent(
      "OUTINT00118618"
    );
  });

  it("validates policy number input against pattern", async () => {
    render(<App />);

    const searchInput = screen.getByTestId("policy-search-input");
    const searchBtn = screen.getByTestId("policy-search-button");

    // Type invalid policy number
    fireEvent.change(searchInput, { target: { value: "INVALID123" } });
    fireEvent.click(searchBtn);

    expect(await screen.findByTestId("policy-search-error")).toBeInTheDocument();
  });

  it("switches policy using quick policy buttons", async () => {
    render(<App />);

    const quickBtn = await screen.findByTestId("quick-policy-OUTINT00334512");
    fireEvent.click(quickBtn);

    expect(await screen.findByTestId("policy-heading")).toHaveTextContent(
      "OUTINT00334512"
    );
  });

  it("navigates to Messages page and loads messages table", async () => {
    render(<App />);

    const messagesNav = screen.getByTestId("nav-messages");
    fireEvent.click(messagesNav);

    expect(
      await screen.findByText("Messages Explorer")
    ).toBeInTheDocument();
    expect(screen.getByTestId("messages-endpoint-filter")).toBeInTheDocument();
    expect(await screen.findByTestId("select-all-checkbox")).toBeInTheDocument();
  });

  it("navigates to Failed messages page and switches tabs", async () => {
    render(<App />);

    const failedNav = screen.getByTestId("nav-failed-messages");
    fireEvent.click(failedNav);

    expect(
      await screen.findByText("Failed Messages Control")
    ).toBeInTheDocument();
    expect(screen.getByTestId("failed-tab-unresolved")).toBeInTheDocument();
    expect(screen.getByTestId("failed-tab-retryIssued")).toBeInTheDocument();
    expect(screen.getByTestId("failed-tab-archived")).toBeInTheDocument();

    // Switch tab
    fireEvent.click(screen.getByTestId("failed-tab-retryIssued"));
    await waitFor(() => {
      expect(screen.getByTestId("failed-tab-retryIssued")).toHaveClass(
        "bg-brand-purple"
      );
    });
  });

  it("opens Message Detail drawer when clicking message row", async () => {
    render(<App />);

    // Click on a message in the timeline
    const msgRow = await screen.findByTestId("timeline-row-msg-02ee40a6");
    fireEvent.click(msgRow);

    expect(
      await screen.findByTestId("message-detail-drawer")
    ).toBeInTheDocument();
    expect(screen.getByTestId("drawer-tab-overview")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-tab-body")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-tab-headers")).toBeInTheDocument();

    // Switch to body tab
    fireEvent.click(screen.getByTestId("drawer-tab-body"));
    expect(await screen.findByTestId("tab-content-body")).toBeInTheDocument();

    // Close drawer
    const closeBtn = screen.getByTestId("drawer-close-button");
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByTestId("message-detail-drawer")).not.toBeInTheDocument();
    });
  });

  it("toggles light/dark theme", () => {
    render(<App />);

    const themeToggle = screen.getByTestId("theme-toggle");
    fireEvent.click(themeToggle);

    expect(document.documentElement).toHaveClass("dark");
  });
});
