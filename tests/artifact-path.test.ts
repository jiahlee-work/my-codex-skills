import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveProjectRoot } from "../plugins/ticket-to-pr-workflow/shared/core/artifact-path.js";

describe("resolveProjectRoot", () => {
  it("uses the current working directory by default", () => {
    expect(resolveProjectRoot([], "/tmp/target-repo")).toBe(
      path.resolve("/tmp/target-repo")
    );
  });

  it("prefers an explicit artifact root", () => {
    expect(
      resolveProjectRoot(["--root", "/tmp/artifact-root"], "/tmp/source-repo")
    ).toBe(path.resolve("/tmp/artifact-root"));
  });

  it("uses the target repository when only --repo is provided", () => {
    expect(
      resolveProjectRoot(["--repo", "/tmp/product-repo"], "/tmp/source-repo")
    ).toBe(path.resolve("/tmp/product-repo"));
  });
});
