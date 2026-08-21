#!/usr/bin/env node
import {
  VERSION,
  scanProject,
  toJson,
  toMarkdown,
  toText
} from "./chunk-PTGAXFXT.js";

// src/cli.ts
import { realpathSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
var HELP = `MesaGuard ${VERSION} \u2014 preflight an o1js project for o1js 3 / Mesa

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
function parseArguments(argv) {
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
  let format = "text";
  let failOn = "high";
  let output;
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
      if (!["text", "markdown", "json"].includes(value)) {
        throw new Error(`Unsupported format '${value}'.`);
      }
      format = value;
    } else if (argument === "--output") {
      output = value;
    } else if (argument === "--fail-on") {
      if (!["high", "medium", "low", "none"].includes(value)) {
        throw new Error(`Unsupported fail-on severity '${value}'.`);
      }
      failOn = value;
    } else {
      throw new Error(`Unknown option '${argument}'.`);
    }
    index += 2;
  }
  return { command: "scan", projectPath, format, output, failOn, color };
}
function render(report, format, color) {
  if (format === "json") return toJson(report);
  if (format === "markdown") return toMarkdown(report);
  return `${toText(report, color)}
`;
}
function shouldFail(report, failOn) {
  if (failOn === "none") return false;
  const rank = { high: 3, medium: 2, low: 1, info: 0 };
  const threshold = rank[failOn];
  return report.findings.some((finding) => rank[finding.severity] >= threshold);
}
async function run(argv) {
  let args;
  try {
    args = parseArguments(argv);
  } catch (error) {
    process.stderr.write(`MesaGuard: ${error instanceof Error ? error.message : String(error)}

${HELP}`);
    return 2;
  }
  if (args.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.command === "version") {
    process.stdout.write(`${VERSION}
`);
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
      process.stderr.write(`MesaGuard: wrote ${outputPath}
`);
    }
    return shouldFail(report, args.failOn) ? 1 : 0;
  } catch (error) {
    process.stderr.write(`MesaGuard: ${error instanceof Error ? error.message : String(error)}
`);
    return 2;
  }
}
var isDirectRun = false;
try {
  isDirectRun = Boolean(
    process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
  );
} catch {
}
if (isDirectRun) {
  process.exitCode = await run(process.argv.slice(2));
}
export {
  parseArguments,
  run
};
//# sourceMappingURL=cli.js.map