import type { Finding, Severity } from "./types.ts";

export interface SourceRule {
  ruleId: string;
  severity: Severity;
  title: string;
  pattern: RegExp;
  message: string;
  remediation: string;
}

export const SOURCE_RULES: SourceRule[] = [
  {
    ruleId: "MG002",
    severity: "high",
    title: "Removed setFeePerSnarkCost() API",
    pattern: /\.setFeePerSnarkCost\s*\(/g,
    message:
      "Transaction.setFeePerSnarkCost() is not available in the Mesa transaction-cost model.",
    remediation:
      "Replace the call with setFeePerAccountUpdate() and retest transaction construction against Mesa limits.",
  },
  {
    ruleId: "MG004",
    severity: "medium",
    title: "VerificationKey.toJSON() return shape needs review",
    pattern:
      /(?:VerificationKey|verificationKey|verification_key|\bvk)\s*\.\s*toJSON\s*\(/gi,
    message:
      "VerificationKey.toJSON() returns { data, hash } in o1js 3 rather than only the data string.",
    remediation:
      "Update consumers, stored fixtures, API schemas, and equality checks to use the object shape explicitly.",
  },
  {
    ruleId: "MG006",
    severity: "high",
    title: "Removed Cairo gate type",
    pattern: /\b(?:CairoClaim|CairoInstruction|CairoFlags|CairoTransition)\b/g,
    message: "Unused Cairo gate types were removed in o1js 3.",
    remediation:
      "Remove the dependency on the Cairo gate type or replace it with a supported gate/API before upgrading.",
  },
  {
    ruleId: "MG008",
    severity: "low",
    title: "Legacy protocol limit appears hard-coded",
    pattern:
      /(?:MAX_ZKAPP_STATE_FIELDS\s*[:=]\s*8\b|MAX_(?:ACTION|EVENT)_ELEMENTS\s*[:=]\s*100\b)/g,
    message:
      "This looks like a pre-Mesa protocol limit (8 state fields or 100 action/event elements).",
    remediation:
      "Replace duplicated constants with current o1js exports, or document why the lower application limit is intentional.",
  },
];

export function transactionCostFindings(relativePath: string, contents: string): Finding[] {
  const directImport = /import\s*\{[^}]*\bTransactionCost\b[^}]*\}\s*from\s*["']o1js["']/s.test(
    contents,
  );
  const namespaceImports = [
    ...contents.matchAll(/import\s*\*\s*as\s*([A-Za-z_$][\w$]*)\s*from\s*["']o1js["']/g),
  ].map((match) => match[1]);
  const patterns: RegExp[] = [];
  if (directImport) {
    patterns.push(
      /\bTransactionCost\s*\.\s*(?:PROOF_COST|SIGNED_PAIR_COST|SIGNED_SINGLE_COST|COST_LIMIT)\b/g,
    );
  }
  for (const namespace of namespaceImports) {
    if (!namespace) continue;
    patterns.push(
      new RegExp(
        `\\b${namespace}\\s*\\.\\s*TransactionCost\\s*\\.\\s*(?:PROOF_COST|SIGNED_PAIR_COST|SIGNED_SINGLE_COST|COST_LIMIT)\\b`,
        "g",
      ),
    );
  }

  const findings: Finding[] = [];
  for (const pattern of patterns) {
    for (const match of contents.matchAll(pattern)) {
      const index = match.index ?? 0;
      const start = contents.lastIndexOf("\n", index) + 1;
      const end = contents.indexOf("\n", index);
      findings.push({
        ruleId: "MG003",
        severity: "high",
        title: "Removed floating-point transaction cost constant",
        message:
          "Mesa replaces the old floating-point cost constants with transaction segment limits.",
        remediation:
          "Use TransactionLimits.MAX_ZKAPP_SEGMENT_PER_TRANSACTION and exercise representative multi-update transactions.",
        file: relativePath,
        line: contents.slice(0, index).split("\n").length,
        excerpt: contents.slice(start, end === -1 ? undefined : end).trim().slice(0, 180),
      });
    }
  }
  return findings;
}

export function signerFindings(relativePath: string, contents: string): Finding[] {
  if (!/(?:from\s+["']mina-signer["']|require\s*\(\s*["']mina-signer["'])/.test(contents)) {
    return [];
  }

  const findings: Finding[] = [];
  const constructorPattern = /new\s+(?:Client|MinaSigner\.Client)\s*\(([^)]*)\)/gs;
  for (const match of contents.matchAll(constructorPattern)) {
    const args = match[1] ?? "";
    const offset = match.index ?? 0;
    const line = contents.slice(0, offset).split("\n").length;
    if (/era\s*:\s*["']berkeley["']/.test(args)) {
      findings.push({
        ruleId: "MG009",
        severity: "medium",
        title: "Signer is explicitly pinned to Berkeley",
        message:
          "This client will keep producing legacy Berkeley-format zkApp commands after the Mesa migration.",
        remediation:
          "Confirm the target network. Remove the Berkeley era only when every downstream signer and endpoint is Mesa-ready.",
        file: relativePath,
        line,
        excerpt: match[0].replace(/\s+/g, " ").slice(0, 180),
      });
    } else {
      findings.push({
        ruleId: "MG005",
        severity: "medium",
        title: "mina-signer default era changes in v4",
        message:
          "mina-signer v4 produces Mesa-format zkApp commands by default; this constructor does not state an era.",
        remediation:
          "Exercise signing and submission end to end. Add era: 'berkeley' only if this path intentionally targets a legacy network.",
        file: relativePath,
        line,
        excerpt: match[0].replace(/\s+/g, " ").slice(0, 180),
      });
    }
  }
  return findings;
}
