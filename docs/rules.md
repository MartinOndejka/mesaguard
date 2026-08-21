# MesaGuard rule reference

Rules target the official [o1js 3.0.0 / Mesa change set](https://github.com/o1-labs/o1js/blob/main/CHANGELOG.md#300---2026-08-18). A finding is evidence for review, not evidence of an exploitable vulnerability.

## MG001 — project pinned below o1js 3

**Why it exists:** A package range that only accepts o1js 2.x cannot receive the Mesa-targeting release. Every verification key changes after the upgrade and caches must be regenerated.

**Review:** Upgrade on a branch, regenerate artifacts in isolation, compile, exercise transactions, compare verification-key manifests, and coordinate any on-chain update.

**Boundary:** Git, file, workspace wildcard, and tag specifiers are reported as ambiguous rather than guessed.

## MG002 — removed `setFeePerSnarkCost()`

**Why it exists:** The transaction cost model now uses account updates and segment limits. The old method is unavailable.

**Review:** Move to `setFeePerAccountUpdate()` and test realistic transactions under `TransactionLimits.MAX_ZKAPP_SEGMENT_PER_TRANSACTION`.

## MG003 — removed `TransactionCost` constants

**Why it exists:** `PROOF_COST`, `SIGNED_PAIR_COST`, `SIGNED_SINGLE_COST`, and `COST_LIMIT` do not model Mesa transaction capacity.

**Review:** Remove arithmetic based on the former floating-point model. Do not translate values mechanically.

## MG004 — verification-key JSON shape

**Why it exists:** `VerificationKey.toJSON()` returns `{ data, hash }`, not only a data string.

**Review:** Inspect storage schemas, API payloads, equality checks, fixtures, and string annotations.

**Boundary:** This is deliberately a review-level lexical match. Code that already accepts the object may still be reported.

## MG005 / MG009 — signer command era

**Why it exists:** `mina-signer` v4 produces Mesa-format zkApp commands by default. Passing `era: 'berkeley'` retains the legacy format.

**Review:** Confirm the network/endpoint target for every signing path and test serialization through submission.

**Boundary:** MesaGuard inspects direct `Client` construction only. Factories, aliases, dependency injection, or wrappers require manual review.

## MG006 — removed Cairo gates

**Why it exists:** `CairoClaim`, `CairoInstruction`, `CairoFlags`, and `CairoTransition` were removed.

## MG007 — likely committed key/cache artifacts

**Why it exists:** The Mesa upgrade changes every verification key and requires cache regeneration.

**Boundary:** Artifact recognition is filename-based and may report application files named like `vk`, `pk`, `srs`, `lagrange`, `step`, or `wrap` inside common key/cache directories.

## MG008 — duplicated pre-Mesa limits

**Why it exists:** Mesa increases zkApp state fields from 8 to 32 and action/event elements from 100 to 1024.

**Boundary:** Keeping stricter application limits can be intentional; this rule is low severity.

## MG010 / MG011 — dependency visibility

These rules make it explicit when MesaGuard cannot prove which o1js version owns the scanned source. Scan the owning workspace package and commit a reviewed lockfile.

## Out of scope

MesaGuard v0.1 does not compile circuits, compare constraint systems, generate verification keys, inspect deployed accounts, or validate fee/signature behavior. These are candidates for an opt-in project adapter after the static inventory is validated with real migrations.
