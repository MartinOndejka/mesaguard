type Severity = "high" | "medium" | "low" | "info";
type Verdict = "blocked" | "review" | "ready";
interface Finding {
    ruleId: string;
    severity: Severity;
    title: string;
    message: string;
    remediation: string;
    file?: string;
    line?: number;
    excerpt?: string;
}
interface DependencyEvidence {
    declared?: string;
    declaredIn?: string;
    resolved?: string;
    lockfile?: string;
}
interface ScanSummary {
    high: number;
    medium: number;
    low: number;
    info: number;
    filesScanned: number;
    verdict: Verdict;
}
interface ScanReport {
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
    sources: Array<{
        label: string;
        url: string;
    }>;
}
interface ScanOptions {
    maxFileBytes?: number;
    now?: Date;
    toolVersion?: string;
}

export type { DependencyEvidence as D, Finding as F, Severity as S, Verdict as V, ScanOptions as a, ScanReport as b, ScanSummary as c };
