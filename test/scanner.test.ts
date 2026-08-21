import { describe, expect, it } from "vitest";
import { scanProject } from "../src/scanner.ts";
import { toJson, toMarkdown, toText } from "../src/report.ts";
import { signerFindings } from "../src/rules.ts";

describe("scanProject", () => {
  it("finds o1js 3 migration blockers and review points", async () => {
    const report = await scanProject("test/fixtures/needs-migration", {
      now: new Date("2026-08-21T12:00:00Z"),
      toolVersion: "test",
    });

    expect(report.summary.verdict).toBe("blocked");
    expect(report.summary.filesScanned).toBe(1);
    expect(report.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining(["MG001", "MG002", "MG003", "MG004", "MG005"]),
    );
    expect(report.findings.find((finding) => finding.ruleId === "MG002")).toMatchObject({
      file: "src/contract.ts",
      line: 7,
    });
  });

  it("does not claim proof safety for a clean static scan", async () => {
    const report = await scanProject("test/fixtures/ready");
    expect(report.summary.verdict).toBe("ready");
    expect(report.findings).toEqual([]);
    expect(report.limitations.join(" ")).toContain("do not prove circuit soundness");
  });

  it("does not confuse a local TransactionCost namespace with the o1js export", async () => {
    const report = await scanProject("test/fixtures/local-cost");
    expect(report.findings.some((finding) => finding.ruleId === "MG003")).toBe(false);
  });

  it("resolves a pnpm catalog and finds nested stale Mesa artifacts", async () => {
    const report = await scanProject("test/fixtures/catalog-workspace/packages/contracts");
    expect(report.project.o1js).toMatchObject({ declared: "catalog:", resolved: "2.4.0" });
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "MG001" }),
        expect.objectContaining({ ruleId: "MG007", file: "public/cache/wrap-vk-contract.txt" }),
      ]),
    );
  });

  it("does not flag mina-signer clients used only for key derivation", () => {
    const source = `
      import { Client } from 'mina-signer';
      const client = new Client({ network: 'mainnet' });
      export const publicKey = client.derivePublicKey('private-key');
    `;
    expect(signerFindings("keygen.ts", source)).toEqual([]);
  });

  it("renders deterministic human and machine reports", async () => {
    const report = await scanProject("test/fixtures/needs-migration", {
      now: new Date("2026-08-21T12:00:00Z"),
    });
    expect(toText(report, false)).toContain("MG002");
    expect(toMarkdown(report)).toContain("Official evidence");
    expect(JSON.parse(toJson(report))).toMatchObject({ schemaVersion: 1 });
  });
});
