import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  inferTicketKey,
  readTestPlanningInputs,
  resolveTestPlanningRunDir,
  updateTestPlanningAgentRunReport,
  type TestPlanningInputs
} from "./test-planning-context.js";
import { writeTextFile } from "../../../shared/core/fs.js";
import { extractMarkdownSection, markdownList } from "../../../shared/core/markdown.js";
import {
  analyzeTestEnvironment,
  renderTestEnvironmentReport,
  type TestEnvironmentAnalysis
} from "./test-environment.js";

export type GenerateTestPlanOptions = {
  rootDir: string;
  repository: string;
  ticketKey?: string;
  runDir?: string;
  intent?: string;
  approvedStack?: string;
};

export type GenerateTestPlanResult = {
  ticketKey: string;
  runDir: string;
  status: "approval-required" | "test-plan-created";
  files: string[];
  missingSetup: string[];
};

function markdownItems(markdown: string, section: string): string[] {
  return extractMarkdownSection(markdown, section)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => Boolean(line) && line !== "None");
}

export function buildTestTaskContext(inputs: TestPlanningInputs): string {
  return [
    extractMarkdownSection(inputs.ticketContextReport, "Ticket Content Summary"),
    extractMarkdownSection(inputs.ticketContextReport, "Explicit Requirements"),
    extractMarkdownSection(inputs.requirementSummary, "Description"),
    extractMarkdownSection(inputs.requirementSummary, "Acceptance Criteria"),
    extractMarkdownSection(inputs.taskSpec, "Objective"),
    extractMarkdownSection(inputs.taskSpec, "In Scope"),
    extractMarkdownSection(inputs.taskSpec, "Acceptance Criteria"),
    inputs.userImplementationIntent ?? ""
  ].join("\n");
}

function inferredIntent(inputs: TestPlanningInputs): string {
  const objective = extractMarkdownSection(inputs.taskSpec, "Objective");
  const inScope = markdownItems(inputs.taskSpec, "In Scope");
  return [
    objective || "Implement the selected ticket according to the approved task spec.",
    inScope.length > 0 ? `Focus on ${inScope.join(", ")}.` : ""
  ].filter(Boolean).join(" ");
}

async function ensureUserIntent(
  runDir: string,
  inputs: TestPlanningInputs,
  explicitIntent?: string
): Promise<string> {
  if (explicitIntent?.trim()) {
    const content = `# User Implementation Intent

## Source

Current conversation

## Summary

${explicitIntent.trim()}
`;
    await writeTextFile(runDir, "user-implementation-intent.md", content);
    return explicitIntent.trim();
  }

  if (inputs.userImplementationIntent?.trim()) {
    return (
      extractMarkdownSection(inputs.userImplementationIntent, "Summary") ||
      inputs.userImplementationIntent.trim()
    );
  }

  const summary = inferredIntent(inputs);
  const content = `# User Implementation Intent

## Source

Inferred from existing planning artifacts because no separate conversation summary was provided to the script.

## Summary

${summary}
`;
  await writeTextFile(runDir, "user-implementation-intent.md", content);
  return summary;
}

export function renderTestSetupProposal(
  analysis: TestEnvironmentAnalysis,
  approvedStack?: string
): string {
  const currentEnvironment = [
    ...analysis.libraries,
    ...analysis.environments,
    ...analysis.commands
  ];

  return `# Test Setup Proposal

## Current Test Environment

${markdownList(currentEnvironment)}

## Missing Test Setup

${markdownList(analysis.missingSetup)}

## Recommended Options

### Option 1. Vitest + Testing Library

Recommended for React/Vite frontend projects.

Expected changes:
- install \`vitest\`
- install \`@testing-library/react\`
- install \`@testing-library/user-event\`
- install \`@testing-library/jest-dom\`
- add or update test script
- add test setup file and \`jsdom\` or \`happy-dom\` if needed

### Option 2. Jest + Testing Library

Recommended for Jest-based projects.

Expected changes:
- install \`jest\`
- install Testing Library packages
- add Jest config if needed
- add or update test script

### Option 3. Playwright

Recommended for browser-based E2E tests.

Expected changes:
- install \`@playwright/test\`
- add Playwright config
- add e2e test script

### Option 4. Add MSW

Recommended if API mocking is required.

Expected changes:
- install \`msw\`
- add mock handlers
- configure test setup

### Option 5. Custom

User provides the preferred test library or setup.

## Approval Status

${approvedStack ? `Approved stack: ${approvedStack}` : "Approval required. No option has been approved."}

## Approval Required

No dependency installation, package.json update, lockfile update, config file creation, setup file creation, or test file creation will be performed until the user approves one option.
`;
}

function ticketTitle(inputs: TestPlanningInputs, ticketKey: string): string {
  const ticketSection = extractMarkdownSection(inputs.ticketContextReport, "Ticket");
  return ticketSection.replace(new RegExp(`^${ticketKey}\\s*`), "").trim() || ticketKey;
}

function testCases(inputs: TestPlanningInputs): string[] {
  const acceptanceCriteria = markdownItems(inputs.requirementSummary, "Acceptance Criteria");
  const criteria =
    acceptanceCriteria.length > 0
      ? acceptanceCriteria
      : markdownItems(inputs.taskSpec, "Acceptance Criteria");

  return criteria.map(
    (criterion, index) =>
      `### Case ${index + 1}\n\n- Scenario: ${criterion}\n- Expected: The observable behavior satisfies the acceptance criterion without regressing adjacent flows.`
  );
}

function recommendedTestTypes(
  analysis: TestEnvironmentAnalysis,
  approvedStack?: string
): string[] {
  const types: string[] = [];
  const stack = approvedStack?.toLowerCase() ?? "";

  if (
    analysis.libraries.includes("vitest") ||
    analysis.libraries.includes("jest") ||
    /\b(vitest|jest)\b/.test(stack)
  ) {
    types.push("Focused unit tests for state transitions, helpers, and error handling.");
  }
  if (
    analysis.taskNeeds.dom ||
    analysis.libraries.includes("@testing-library/react") ||
    stack.includes("testing library")
  ) {
    types.push("Component integration tests for user-visible behavior and interactions.");
  }
  if (analysis.taskNeeds.apiMocking) {
    types.push("Request success and failure-path tests with deterministic API mocks.");
  }
  if (
    analysis.taskNeeds.e2e ||
    analysis.libraries.includes("@playwright/test") ||
    stack.includes("playwright")
  ) {
    types.push("A narrow browser E2E regression test for the critical user flow.");
  }

  return [...new Set(types)];
}

function mockingStrategy(
  analysis: TestEnvironmentAnalysis,
  approvedStack?: string
): string[] {
  if (!analysis.taskNeeds.apiMocking) {
    return [
      "Prefer real pure functions and local fixtures; mock only external boundaries that make the test nondeterministic."
    ];
  }

  const hasMsw = analysis.libraries.includes("msw") || approvedStack?.toLowerCase().includes("msw");
  return [
    hasMsw
      ? "Use MSW handlers for success, recoverable error, and unexpected error responses."
      : "Use the existing runner's module or request-boundary mocks; add MSW only after explicit approval.",
    "Keep mocks local to each scenario and assert user-visible outcomes rather than internal calls."
  ];
}

function suggestedTestFiles(
  analysis: TestEnvironmentAnalysis,
  inputs: TestPlanningInputs,
  ticketKey: string
): string[] {
  const titleSlug = ticketTitle(inputs, ticketKey)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const extension = analysis.taskNeeds.dom ? "test.tsx" : "test.ts";
  const suggestions = [
    `Co-locate with the implementation using \`${titleSlug || ticketKey.toLowerCase()}.${extension}\`.`
  ];

  if (analysis.testFiles.length > 0) {
    suggestions.push(
      `Follow nearby examples such as \`${analysis.testFiles.slice(0, 2).join("`, `")}\`.`
    );
  } else {
    suggestions.push("Confirm the final source path during implementation before creating the test file.");
  }

  if (analysis.taskNeeds.e2e) {
    suggestions.push(`Use \`tests/${titleSlug || ticketKey.toLowerCase()}.spec.ts\` for E2E coverage.`);
  }

  return suggestions;
}

export function renderTestPlan(
  inputs: TestPlanningInputs,
  ticketKey: string,
  intentSummary: string,
  analysis: TestEnvironmentAnalysis,
  approvedStack?: string
): string {
  const environmentSummary = [
    `Libraries: ${analysis.libraries.join(", ") || "none"}`,
    `Commands: ${analysis.commands.join(", ") || "none"}`,
    `Environment: ${analysis.environments.join(", ") || "unknown"}`,
    approvedStack ? `Approved stack: ${approvedStack}` : ""
  ].filter(Boolean);
  const cases = testCases(inputs);
  const nonGoals = markdownItems(inputs.taskSpec, "Out Of Scope");
  const data = analysis.taskNeeds.apiMocking
    ? [
        "Nominal success response.",
        "Expected recoverable error response.",
        "Unexpected or malformed error response.",
        "User input that triggers the state reset or retry behavior."
      ]
    : ["Nominal input.", "Boundary or empty input.", "Invalid input or failure state."];

  return `# Test Plan

## Ticket

${ticketKey} ${ticketTitle(inputs, ticketKey)}

## User Implementation Intent

${intentSummary}

## Test Environment Summary

${markdownList(environmentSummary)}

## Test Objectives

- Map each acceptance criterion to an observable automated check.
- Protect the existing success path while covering the requested failure or state-change behavior.
- Keep implementation tests focused on the files changed by the implementation.

## Recommended Test Types

${markdownList(recommendedTestTypes(analysis, approvedStack))}

## Test Cases

${cases.length > 0 ? cases.join("\n\n") : "- Define concrete cases after clarifying the acceptance criteria."}

## Mocking Strategy

${markdownList(mockingStrategy(analysis, approvedStack))}

## Test Data

${markdownList(data)}

## Suggested Test Files

${markdownList(suggestedTestFiles(analysis, inputs, ticketKey))}

## Non-goals

${markdownList(nonGoals)}

## Notes for Implementation

Implementation should add or update test files together with the implementation code. Re-run focused tests first, then use the approved verification scope.
`;
}

export async function generateTestPlanArtifacts(
  options: GenerateTestPlanOptions
): Promise<GenerateTestPlanResult> {
  const runDir = await resolveTestPlanningRunDir({
    rootDir: options.rootDir,
    ticketKey: options.ticketKey,
    runDir: options.runDir
  });
  const inputs = await readTestPlanningInputs(runDir);
  const ticketKey = options.ticketKey ?? inferTicketKey(inputs, runDir);
  const intentSummary = await ensureUserIntent(runDir, inputs, options.intent);
  const inputsWithIntent = {
    ...inputs,
    userImplementationIntent: await readFile(
      path.join(runDir, "user-implementation-intent.md"),
      "utf8"
    )
  };
  const analysis = await analyzeTestEnvironment(
    options.repository,
    buildTestTaskContext(inputsWithIntent)
  );
  const files = ["user-implementation-intent.md", "test-environment-report.md"];

  await writeTextFile(
    runDir,
    "test-environment-report.md",
    renderTestEnvironmentReport(analysis)
  );

  if (!analysis.setupComplete) {
    await writeTextFile(
      runDir,
      "test-setup-proposal.md",
      renderTestSetupProposal(analysis, options.approvedStack)
    );
    files.push("test-setup-proposal.md");
  }

  if (!analysis.setupComplete && !options.approvedStack) {
    await updateTestPlanningAgentRunReport(runDir, {
      status: "approval-required",
      repository: options.repository,
      generatedFiles: files,
      missingSetup: analysis.missingSetup
    });
    return {
      ticketKey,
      runDir,
      status: "approval-required",
      files,
      missingSetup: analysis.missingSetup
    };
  }

  await writeTextFile(
    runDir,
    "test-plan.md",
    renderTestPlan(
      inputsWithIntent,
      ticketKey,
      intentSummary,
      analysis,
      options.approvedStack
    )
  );
  files.push("test-plan.md");
  await updateTestPlanningAgentRunReport(runDir, {
    status: "test-plan-created",
    repository: options.repository,
    generatedFiles: files,
    missingSetup: analysis.missingSetup,
    approvedStack: options.approvedStack
  });

  return {
    ticketKey,
    runDir,
    status: "test-plan-created",
    files,
    missingSetup: analysis.missingSetup
  };
}
