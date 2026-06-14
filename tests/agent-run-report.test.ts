import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  replaceAgentRunReportSection,
  updateAgentRunReportSection
} from "../plugins/ticket-to-pr-workflow/shared/core/agent-run-report.js";

describe("agent run report section writer", () => {
  it("creates one report and replaces a named section without duplicating it", async () => {
    const runDir = await mkdtemp(path.join(os.tmpdir(), "agent-run-report-"));

    await updateAgentRunReportSection(runDir, "Planning", "- Status: created");
    await updateAgentRunReportSection(runDir, "Planning", "- Status: refreshed");
    await updateAgentRunReportSection(
      runDir,
      "Local Verification",
      "- Status: passed"
    );

    const report = await readFile(path.join(runDir, "agent-run-report.md"), "utf8");

    expect(report).toContain("# Agent Run Report");
    expect(report.match(/^## Planning$/gm)).toHaveLength(1);
    expect(report).toContain("## Planning\n\n- Status: refreshed");
    expect(report).toContain("## Local Verification\n\n- Status: passed");
    expect(report).not.toContain("- Status: created");
  });

  it("honors legacy section aliases when replacing content", () => {
    const report = replaceAgentRunReportSection(
      "# Agent Run Report\n\n## Browser Scenario Status\n\nold\n",
      "Browser Verification Status",
      "passed",
      ["Browser Scenario Status"]
    );

    expect(report).toContain("## Browser Verification Status\n\npassed");
    expect(report).not.toContain("Browser Scenario Status");
  });
});
