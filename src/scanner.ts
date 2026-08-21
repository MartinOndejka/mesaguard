import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { SOURCE_RULES, signerFindings, transactionCostFindings } from "./rules.ts";
import type {
  DependencyEvidence,
  Finding,
  ScanOptions,
  ScanReport,
  Severity,
} from "./types.ts";

const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

export const OFFICIAL_SOURCES = [
  {
    label: "o1js 3.0.0 changelog",
    url: "https://github.com/o1-labs/o1js/blob/main/CHANGELOG.md#300---2026-08-18",
  },
  {
    label: "o1js releases",
    url: "https://github.com/o1-labs/o1js/releases/tag/3.0.0",
  },
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function findAncestorFile(start: string, filename: string): Promise<string | undefined> {
  let directory = path.resolve(start);
  while (true) {
    const candidate = path.join(directory, filename);
    if (await exists(candidate)) return candidate;
    if (await exists(path.join(directory, ".git"))) return undefined;
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

async function resolvePnpmCatalog(
  root: string,
  specifier: string,
): Promise<{ resolved?: string; lockfile?: string }> {
  if (!specifier.startsWith("catalog:")) return {};
  const workspacePath = await findAncestorFile(root, "pnpm-workspace.yaml");
  if (!workspacePath) return {};
  let contents: string;
  try {
    contents = await readFile(workspacePath, "utf8");
  } catch {
    return {};
  }

  const catalogName = specifier.slice("catalog:".length);
  const lines = contents.split("\n");
  let inCatalog = false;
  let inNamedCatalog = false;
  for (const line of lines) {
    if (!catalogName && /^catalog:\s*(?:#.*)?$/.test(line)) {
      inCatalog = true;
      continue;
    }
    if (catalogName && /^catalogs:\s*(?:#.*)?$/.test(line)) {
      inCatalog = true;
      continue;
    }
    if (inCatalog && catalogName && new RegExp(`^  ${catalogName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*$`).test(line)) {
      inNamedCatalog = true;
      continue;
    }
    if (inCatalog && /^\S/.test(line)) break;
    const expectedIndent = catalogName ? (inNamedCatalog ? 4 : -1) : 2;
    if (expectedIndent < 0) continue;
    const match = line.match(new RegExp(`^ {${expectedIndent}}o1js:\\s*["']?([^\\s#"']+)`));
    if (match?.[1]) {
      return {
        resolved: match[1],
        lockfile: `${path.relative(root, workspacePath) || "pnpm-workspace.yaml"} (catalog)`,
      };
    }
  }
  return {};
}

function dependencyFrom(
  manifest: Record<string, unknown>,
): { declared?: string; declaredIn?: string } {
  for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const group = manifest[key];
    if (group && typeof group === "object" && "o1js" in group) {
      const value = (group as Record<string, unknown>).o1js;
      if (typeof value === "string") return { declared: value, declaredIn: key };
    }
  }
  return {};
}

function majorVersions(specifier: string): number[] {
  const clean = specifier.replace(/(?:workspace|npm):/g, "");
  return [...clean.matchAll(/(?:^|[^\d])(\d+)(?:\.\d+)?(?:\.\d+)?/g)]
    .map((match) => Number(match[1]))
    .filter((major) => Number.isInteger(major));
}

function acceptsO1js3(specifier: string): boolean | undefined {
  if (/^(?:\*|latest|next)$/i.test(specifier.trim())) return undefined;
  if (/github:|git\+|https?:|file:|link:/.test(specifier)) return undefined;
  const majors = majorVersions(specifier);
  if (majors.length === 0) return undefined;
  if (specifier.includes("||")) return majors.includes(3);
  return majors.every((major) => major >= 3);
}

async function resolvedDependency(root: string): Promise<Pick<DependencyEvidence, "resolved" | "lockfile">> {
  const packageLockPath = path.join(root, "package-lock.json");
  const packageLock = await readJson(packageLockPath);
  if (packageLock) {
    const packages = packageLock.packages;
    if (packages && typeof packages === "object") {
      const o1js = (packages as Record<string, unknown>)["node_modules/o1js"];
      if (o1js && typeof o1js === "object" && typeof (o1js as Record<string, unknown>).version === "string") {
        return {
          resolved: (o1js as Record<string, string>).version,
          lockfile: "package-lock.json",
        };
      }
    }
  }

  for (const lockfile of ["pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"]) {
    const lockPath = path.join(root, lockfile);
    if (!(await exists(lockPath))) continue;
    try {
      const contents = await readFile(lockPath, "utf8");
      const patterns = [
        /(?:^|\n)\s*["']?o1js@[^\n]*["']?:\s*\n(?:[^\n]*\n){0,8}?\s*version:\s*["']?([^\s"']+)/,
        /(?:^|\n)\s*["']?o1js@[^\n]*["']?:\s*\n(?:[^\n]*\n){0,8}?\s*version\s+["']?([^\s"']+)/,
        /(?:^|\n)\s*["']?o1js@["']?\s*:\s*["']?([^\s,"']+)/,
      ];
      for (const pattern of patterns) {
        const match = contents.match(pattern);
        if (match?.[1]) return { resolved: match[1], lockfile };
      }
      return { lockfile };
    } catch {
      return { lockfile };
    }
  }
  return {};
}

async function walkFiles(root: string, maxFileBytes: number): Promise<string[]> {
  const output: string[] = [];
  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) await walk(absolute);
        continue;
      }
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      try {
        if ((await stat(absolute)).size <= maxFileBytes) output.push(absolute);
      } catch {
        // A file changing during a scan should not abort the remaining inventory.
      }
    }
  }
  await walk(root);
  return output.sort();
}

function lineAt(contents: string, index: number): number {
  return contents.slice(0, index).split("\n").length;
}

function excerptAt(contents: string, index: number): string {
  const start = contents.lastIndexOf("\n", index) + 1;
  const end = contents.indexOf("\n", index);
  return contents.slice(start, end === -1 ? undefined : end).trim().slice(0, 180);
}

function sourceFindings(relativePath: string, contents: string): Finding[] {
  const findings: Finding[] = [];
  for (const rule of SOURCE_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of contents.matchAll(pattern)) {
      const index = match.index ?? 0;
      findings.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        title: rule.title,
        message: rule.message,
        remediation: rule.remediation,
        file: relativePath,
        line: lineAt(contents, index),
        excerpt: excerptAt(contents, index),
      });
    }
  }
  return [
    ...findings,
    ...transactionCostFindings(relativePath, contents),
    ...signerFindings(relativePath, contents),
  ];
}

async function staleCacheFinding(root: string): Promise<Finding | undefined> {
  const artifacts: string[] = [];
  async function walk(directory: string): Promise<void> {
    if (artifacts.length >= 5_000) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(root, absolute);
      const components = relative.split(path.sep).map((component) => component.toLowerCase());
      const basename = entry.name.toLowerCase();
      const inCache = components.some((component) => component === "cache" || component === ".cache");
      const inKeyDirectory = components.some((component) =>
        ["keys", "proving-keys", "verification-keys"].includes(component),
      );
      const keyLike =
        /(?:^|[-_.])(?:vk|pk|srs|lagrange|step|wrap)(?:[-_.]|$)/i.test(entry.name) ||
        /(?:vk|pk)\.[^.]+$/i.test(entry.name);
      const namedKey = /(?:verification|proving)[-_.]?key/i.test(entry.name);
      const nonSourceKey = namedKey && !SOURCE_EXTENSIONS.has(path.extname(basename));
      if ((inCache && keyLike) || (inKeyDirectory && (keyLike || namedKey)) || nonSourceKey) {
        artifacts.push(relative);
      }
    }
  }
  await walk(root);
  if (artifacts.length === 0) return undefined;
  const examples = artifacts.slice(0, 3).join(", ");
  return {
    ruleId: "MG007",
    severity: "medium",
    title: "Committed proof/cache artifacts need regeneration",
    message: `Found ${artifacts.length} likely proving, verification-key, or cache artifact(s), including ${examples}. Every verification key changes for Mesa.`,
    remediation:
      "Regenerate artifacts with o1js 3 in an isolated directory, review the verification-key diff, and update deployments deliberately.",
    file: artifacts[0],
  };
}

function severityRank(severity: Severity): number {
  return { high: 0, medium: 1, low: 2, info: 3 }[severity];
}

export async function scanProject(projectPath: string, options: ScanOptions = {}): Promise<ScanReport> {
  const root = path.resolve(projectPath);
  const manifestPath = path.join(root, "package.json");
  const manifest = await readJson(manifestPath);
  if (!manifest) {
    throw new Error(`No readable package.json found at ${manifestPath}`);
  }

  const declared = dependencyFrom(manifest);
  const catalog = declared.declared
    ? await resolvePnpmCatalog(root, declared.declared)
    : {};
  const resolved = catalog.resolved ? catalog : await resolvedDependency(root);
  const dependency: DependencyEvidence = { ...declared, ...resolved };
  const findings: Finding[] = [];

  if (dependency.declared) {
    const supports3 = acceptsO1js3(dependency.resolved ?? dependency.declared);
    if (supports3 === false) {
      findings.push({
        ruleId: "MG001",
        severity: "high",
        title: "Project is pinned below o1js 3",
        message: `package.json declares o1js ${dependency.declared}${dependency.resolved ? ` (resolved ${dependency.resolved})` : ""}.`,
        remediation:
          "Upgrade o1js on a migration branch, clear/regenerate caches, then compile and test against the Mesa target network.",
        file: "package.json",
      });
    } else if (supports3 === undefined) {
      findings.push({
        ruleId: "MG010",
        severity: "medium",
        title: "o1js dependency target is ambiguous",
        message: `MesaGuard cannot prove that dependency specifier '${dependency.declared}' resolves to o1js 3.`,
        remediation: "Pin a reviewed o1js 3 range and commit the updated lockfile.",
        file: "package.json",
      });
    }
  }

  const files = await walkFiles(root, options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES);
  let importsO1js = false;
  for (const absolutePath of files) {
    let contents: string;
    try {
      contents = await readFile(absolutePath, "utf8");
    } catch {
      continue;
    }
    if (/(?:from\s+["']o1js["']|require\s*\(\s*["']o1js["'])/.test(contents)) importsO1js = true;
    findings.push(...sourceFindings(path.relative(root, absolutePath), contents));
  }

  if (!dependency.declared && importsO1js) {
    findings.push({
      ruleId: "MG011",
      severity: "medium",
      title: "o1js is imported but not declared in this package",
      message: "Source files import o1js, but this package.json does not declare it directly.",
      remediation:
        "Scan the owning workspace package or declare the dependency here so the migration target is auditable.",
      file: "package.json",
    });
  }

  const effectiveSpecifier = dependency.resolved ?? dependency.declared;
  if (effectiveSpecifier && acceptsO1js3(effectiveSpecifier) === false) {
    const cacheFinding = await staleCacheFinding(root);
    if (cacheFinding) findings.push(cacheFinding);
  }

  findings.sort((left, right) => {
    const severity = severityRank(left.severity) - severityRank(right.severity);
    if (severity !== 0) return severity;
    return `${left.file ?? ""}:${left.line ?? 0}:${left.ruleId}`.localeCompare(
      `${right.file ?? ""}:${right.line ?? 0}:${right.ruleId}`,
    );
  });

  const counts = {
    high: findings.filter((finding) => finding.severity === "high").length,
    medium: findings.filter((finding) => finding.severity === "medium").length,
    low: findings.filter((finding) => finding.severity === "low").length,
    info: findings.filter((finding) => finding.severity === "info").length,
  };

  return {
    schemaVersion: 1,
    tool: { name: "MesaGuard", version: options.toolVersion ?? "0.1.0" },
    generatedAt: (options.now ?? new Date()).toISOString(),
    project: {
      name: typeof manifest.name === "string" ? manifest.name : path.basename(root),
      path: root,
      o1js: dependency,
    },
    target: { o1js: "3.x", protocol: "Mesa", releaseDate: "2026-08-18" },
    summary: {
      ...counts,
      filesScanned: files.length,
      verdict: counts.high > 0 ? "blocked" : counts.medium > 0 ? "review" : "ready",
    },
    findings,
    limitations: [
      "Static matches identify migration work; they do not prove circuit soundness or deployment safety.",
      "MesaGuard does not compile contracts, regenerate keys, submit transactions, or inspect private dependencies.",
      "A clean report does not prove that verification keys, fees, signers, caches, and target networks were migrated correctly.",
    ],
    sources: OFFICIAL_SOURCES,
  };
}
