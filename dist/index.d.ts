import { a as ScanOptions, b as ScanReport } from './types-CTqZ4Vc9.js';
export { D as DependencyEvidence, F as Finding, c as ScanSummary, S as Severity, V as Verdict } from './types-CTqZ4Vc9.js';

declare function scanProject(projectPath: string, options?: ScanOptions): Promise<ScanReport>;

declare function toText(report: ScanReport, color?: boolean): string;
declare function toMarkdown(report: ScanReport): string;
declare function toJson(report: ScanReport): string;

export { ScanOptions, ScanReport, scanProject, toJson, toMarkdown, toText };
