export type Severity = "high" | "medium" | "low" | "info";
export type Verdict = "blocked" | "review" | "ready";

export interface Finding {
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  remediation: string;
  file?: string;
  line?: number;
  excerpt?: string;
}

export interface DependencyEvidence {
  declared?: string;
  declaredIn?: string;
  resolved?: string;
  lockfile?: string;
}

export interface ScanSummary {
  high: number;
  medium: number;
  low: number;
  info: number;
  filesScanned: number;
  verdict: Verdict;
}

export interface ScanReport {
  schemaVersion: 1;
  tool: {
    name: "MesaGuard";
    version: string;
  };
  generatedAt: string;
  project: {
    name: string;
    path: string;
    o1js: DependencyEvidence;
  };
  target: {
    o1js: "3.x";
    protocol: "Mesa";
    releaseDate: "2026-08-18";
  };
  summary: ScanSummary;
  findings: Finding[];
  limitations: string[];
  sources: Array<{ label: string; url: string }>;
}

export interface ScanOptions {
  maxFileBytes?: number;
  now?: Date;
  toolVersion?: string;
}
