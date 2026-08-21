import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { toJson, toMarkdown, toText } from "./report.ts";
import { scanProject } from "./scanner.ts";
import type { ScanReport, Severity } from "./types.ts";

type Format = "text" | "markdown" | "json";
type FailOn = Severity | "none";

interface Arguments {
  command: "scan" | "help" | "version";
  projectPath: string;
  format: Format;
  output?: string;
  failOn: FailOn;
  color: boolean;
}

const VERSION = "0.1.0";

const HELP = `MesaGuard ${VERSION} — preflight an o1js project for o1js 3 / Mesa

Usage:
  mesaguard scan [path] [options]
  mesaguard --help
  mesaguard --version

Options:
  --format <text|markdown|json>  Report format (default: text)
  --output <file>                Also write the report to a file
  --fail-on <high|medium|low|none>
                                 Exit 1 at or above severity (default: high)
  --no-color                     Disable ANSI colors in text output

Examples:
  npx mesaguard scan .
  npx mesaguard scan . --format markdown --output mesaguard-report.md
  npx mesaguard scan packages/contracts --format json --fail-on medium

MesaGuard is a static migration inventory, not a security audit or proof of
deployment safety. Official o1js 3 change set:
https://github.com/o1-labs/o1js/blob/main/CHANGELOG.md#300---2026-08-18
`;

export function parseArguments(argv: string[]): Arguments {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { command: "help", projectPath: ".", format: "text", failOn: "high", color: true };
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    return { command: "version", projectPath: ".", format: "text", failOn: "high", color: true };
  }

  let index = 0;
  if (argv[0] === "scan") index += 1;
  else if (argv[0]?.startsWith("-")) index = 0;
  else if (argv[0]) throw new Error(`Unknown command '${argv[0]}'. Use 'mesaguard scan [path]'.`);

  let projectPath = ".";
  let format: Format = "text";
  let failOn: FailOn = "high";
  let output: string | undefined;
  let color = process.stdout.isTTY;

  if (argv[index] && !argv[index]?.startsWith("-")) {
    projectPath = argv[index] ?? ".";
    index += 1;
  }

  while (index < argv.length) {
    const argument = argv[index];
    if (argument === "--no-color") {
      color = false;
      index += 1;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${argument}`);
    if (argument === "--format") {
      if (!(["text", "markdown", "json"] as string[]).includes(value)) {
        throw new Error(`Unsupported format '${value}'.`);
      }
      format = value as Format;
    } else if (argument === "--output") {
      output = value;
    } else if (argument === "--fail-on") {
      if (!(["high", "medium", "low", "none"] as string[]).includes(value)) {
        throw new Error(`Unsupported fail-on severity '${value}'.`);
      }
      failOn = value as FailOn;
    } else {
      throw new Error(`Unknown option '${argument}'.`);
    }
    index += 2;
  }

  return { command: "scan", projectPath, format, output, failOn, color };
}

function render(report: ScanReport, format: Format, color: boolean): string {
  if (format === "json") return toJson(report);
  if (format === "markdown") return toMarkdown(report);
  return `${toText(report, color)}\n`;
}

function shouldFail(report: ScanReport, failOn: FailOn): boolean {
  if (failOn === "none") return false;
  const rank: Record<Severity, number> = { high: 3, medium: 2, low: 1, info: 0 };
  const threshold = rank[failOn];
  return report.findings.some((finding) => rank[finding.severity] >= threshold);
}

export async function run(argv: string[]): Promise<number> {
  let args: Arguments;
  try {
    args = parseArguments(argv);
  } catch (error) {
    process.stderr.write(`MesaGuard: ${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
    return 2;
  }

  if (args.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.command === "version") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  try {
    const report = await scanProject(args.projectPath, { toolVersion: VERSION });
    const contents = render(report, args.format, args.color);
    process.stdout.write(contents);
    if (args.output) {
      const outputPath = path.resolve(args.output);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, contents, "utf8");
      process.stderr.write(`MesaGuard: wrote ${outputPath}\n`);
    }
    return shouldFail(report, args.failOn) ? 1 : 0;
  } catch (error) {
    process.stderr.write(`MesaGuard: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  process.exitCode = await run(process.argv.slice(2));
}
