import { describe, expect, it } from "vitest";
import { parseArguments } from "../src/cli.ts";

describe("parseArguments", () => {
  it("parses scan options", () => {
    expect(
      parseArguments([
        "scan",
        "packages/contracts",
        "--format",
        "json",
        "--fail-on",
        "medium",
        "--output",
        "report.json",
        "--no-color",
      ]),
    ).toMatchObject({
      command: "scan",
      projectPath: "packages/contracts",
      format: "json",
      failOn: "medium",
      output: "report.json",
      color: false,
    });
  });

  it("rejects unknown options", () => {
    expect(() => parseArguments(["scan", "--wat", "value"])).toThrow("Unknown option");
  });
});
