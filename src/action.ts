import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { toJson, toMarkdown } from "./report.ts";
import { scanProject } from "./scanner.ts";
import type { Finding, Severity } from "./types.ts";
import { VERSION } from "./version.ts";

const rank: Record<Severity, number> = { high: 3, medium: 2, low: 1, info: 0 };

function input(name: string, fallback: string): string {
  return process.env[`INPUT_${name.replaceAll("-", "_").toUpperCase()}`]?.trim() || fallback;
}

function commandEscape(value: string): string {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function propertyEscape(value: string): string {
  return commandEscape(value)
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C");
}

function annotation(finding: Finding): void {
  const level = finding.severity === "high" ? "error" : finding.severity === "medium" ? "warning" : "notice";
  const properties = [
    finding.file ? `file=${propertyEscape(finding.file)}` : "",
    finding.line ? `line=${finding.line}` : "",
    `title=${propertyEscape(`${finding.ruleId}: ${finding.title}`)}`,
  ]
    .filter(Boolean)
    .join(",");
  const message = commandEscape(`${finding.message} Migration action: ${finding.remediation}`);
  process.stdout.write(`::${level} ${properties}::${message}\n`);
}

async function setOutput(name: string, value: string): Promise<void> {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    await appendFile(outputFile, `${name}=${value}\n`, "utf8");
  } else {
    process.stdout.write(`::set-output name=${propertyEscape(name)}::${commandEscape(value)}\n`);
  }
}

async function run(): Promise<void> {
  try {
    const projectPath = input("path", ".");
    const failOn = input("fail-on", "high") as Severity | "none";
    const output = input("output", "mesaguard-report.md");
    if (!["high", "medium", "low", "none"].includes(failOn)) {
      throw new Error(`Invalid fail-on input '${failOn}'.`);
    }
    const report = await scanProject(projectPath, { toolVersion: VERSION });
    const markdown = toMarkdown(report);

    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    await writeFile(output, markdown, "utf8");
    await writeFile(`${output}.json`, toJson(report), "utf8");
    for (const finding of report.findings) annotation(finding);

    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
    }
    await setOutput("verdict", report.summary.verdict);
    await setOutput("high", String(report.summary.high));
    await setOutput("medium", String(report.summary.medium));
    await setOutput("report", output);

    if (failOn !== "none" && report.findings.some((finding) => rank[finding.severity] >= rank[failOn])) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`::error title=MesaGuard failed::${commandEscape(message)}\n`);
    process.exitCode = 2;
  }
}

void run();
