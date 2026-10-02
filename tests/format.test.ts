import { describe, it, expect } from "vitest";
import {
  shortTypeName,
  formatLocalTime,
  formatShortTime,
  formatUtcTime,
  formatRelativeTime,
  extractProblemDetails,
} from "../src/utils/format";

describe("format utils", () => {
  describe("shortTypeName", () => {
    it("extracts short name from fully qualified .NET type name", () => {
      const full =
        "Stratos.Core.PolicyAdmin.Commands.Policies.ExpireSoftLock.ExpireSoftLockCommand";
      expect(shortTypeName(full)).toBe("ExpireSoftLockCommand");
    });

    it("strips assembly information if present", () => {
      const withAssembly =
        "Stratos.Core.PolicyAdmin.Events.PolicySoftLockedEvent, Stratos.Core.PolicyAdmin.Messages";
      expect(shortTypeName(withAssembly)).toBe("PolicySoftLockedEvent");
    });

    it("handles null and undefined gracefully", () => {
      expect(shortTypeName(null)).toBe("Unknown");
      expect(shortTypeName(undefined)).toBe("Unknown");
      expect(shortTypeName("")).toBe("Unknown");
    });
  });

  describe("time formatting", () => {
    const iso = "2026-10-02T13:15:00.000Z";

    it("formats local time", () => {
      const local = formatLocalTime(iso);
      expect(local).toContain("2026");
      expect(formatLocalTime(null)).toBe("—");
    });

    it("formats short time", () => {
      const short = formatShortTime(iso);
      expect(typeof short).toBe("string");
      expect(formatShortTime(null)).toBe("—");
    });

    it("formats UTC time", () => {
      const utc = formatUtcTime(iso);
      expect(utc).toContain("2026-10-02 13:15:00.000 UTC");
      expect(formatUtcTime(null)).toBe("—");
    });

    it("formats relative time", () => {
      expect(formatRelativeTime(null)).toBe("");
      expect(formatRelativeTime("invalid-date")).toBe("");
      const nowIso = new Date().toISOString();
      const rel = formatRelativeTime(nowIso);
      expect(rel).toBe("just now");
    });
  });

  describe("extractProblemDetails", () => {
    it("extracts problem details from RFC 7807 problem object", () => {
      const problem = {
        title: "Action Disabled",
        detail: "Cannot retry in PROD",
        status: 403,
      };
      const res = extractProblemDetails(problem);
      expect(res.title).toBe("Action Disabled");
      expect(res.detail).toBe("Cannot retry in PROD");
      expect(res.status).toBe(403);
    });

    it("extracts from generic Error instance", () => {
      const err = new Error("Network request failed");
      const res = extractProblemDetails(err);
      expect(res.title).toBe("Request Failed");
      expect(res.detail).toBe("Network request failed");
      expect(res.status).toBe(500);
    });

    it("handles unexpected error types", () => {
      const res = extractProblemDetails("string error");
      expect(res.title).toBe("Unexpected Error");
      expect(res.detail).toBe("string error");
    });
  });
});
