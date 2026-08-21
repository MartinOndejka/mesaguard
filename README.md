# MesaGuard

**Know what o1js 3 / Mesa will break before you change a key or deploy a transaction.**

MesaGuard is a local CLI and GitHub Action that inventories the concrete migration hazards in the official [o1js 3.0.0 change set](https://github.com/o1-labs/o1js/blob/main/CHANGELOG.md#300---2026-08-18). It produces reviewable text, Markdown, and JSON reports without uploading source code.

Start with the [practical o1js 3 / Mesa migration guide](https://martinondejka.github.io/mesaguard/o1js-3-migration-guide.html) if you need the wider key, cache, testing, and deployment-review sequence around the static scan.

> MesaGuard is a migration preflight, not a security audit. A clean report does not prove circuit soundness, key safety, transaction validity, or deployment readiness.

## Why now

o1js 3.0.0 targets Mina's Mesa hard fork. The official release notes state that all verification keys change and caches must be regenerated. The release also changes transaction cost/limit APIs, verification-key JSON, and `mina-signer`'s default command era.

## Run it

Preview the CLI directly from the public repository:

```bash
npx github:MartinOndejka/mesaguard scan .
```

Write a review artifact:

```bash
npx github:MartinOndejka/mesaguard scan . \
  --format markdown \
  --output mesaguard-report.md \
  --fail-on high
```

### GitHub Action

```yaml
name: Mesa migration preflight

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  mesaguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MartinOndejka/mesaguard@v0
        with:
          path: .
          fail-on: high
```

The Action adds file annotations, a job summary, `mesaguard-report.md`, and a JSON report beside it. It requires only `contents: read`.

## Migration help

The scanner is free and open source. If the static inventory is only the first step, two fixed-scope services are available:

- **Migration readout — €149:** a manual review of one TypeScript workspace, with an o1js 3 change map, key/cache inventory, and prioritized next steps delivered as a Markdown report.
- **Migration patch — €299:** the readout plus a pull request for one standard public repository. Deployment coordination, production key rotation, audits, and large monorepos are quoted separately.

[Request migration help](https://github.com/MartinOndejka/mesaguard/issues/new?template=migration-help.yml) without posting source, secrets, private paths, or key material. Scope and payment are confirmed before work starts. These are launch prices and may change as the service is validated.

## What v0.1 checks

| Rule | Severity | Migration signal |
|---|---:|---|
| `MG001` | High | `o1js` is pinned below version 3 |
| `MG002` | High | Removed `Transaction.setFeePerSnarkCost()` usage |
| `MG003` | High | Removed floating-point `TransactionCost` constants |
| `MG004` | Medium | `VerificationKey.toJSON()` consumers that need the new `{ data, hash }` shape reviewed |
| `MG005` | Medium | `mina-signer` construction that relies on the changed default era |
| `MG006` | High | Removed Cairo gate types |
| `MG007` | Medium | Committed key/cache artifacts that need Mesa regeneration |
| `MG008` | Low | Pre-Mesa protocol limits duplicated in source |
| `MG009` | Medium | Signers explicitly pinned to the Berkeley era |
| `MG010` | Medium | Ambiguous `o1js` dependency targets |
| `MG011` | Medium | Source imports `o1js` without a direct package declaration |

See [docs/rules.md](docs/rules.md) for evidence, remediation notes, and known false-positive boundaries.

## CLI reference

```text
mesaguard scan [path] [options]

--format <text|markdown|json>   Report format (default: text)
--output <file>                 Also write the report to a file
--fail-on <high|medium|low|none>
                                Exit 1 at or above severity (default: high)
--no-color                      Disable ANSI colors
```

Exit codes:

- `0`: scan completed and did not meet the configured failure threshold
- `1`: findings met the configured threshold
- `2`: usage or scan error

## What it intentionally does not do

- compile or prove project-specific contracts;
- regenerate or deploy verification keys;
- infer whether a verification-key change is economically or operationally safe;
- submit transactions or connect to a Mina network;
- claim a security audit, formal verification, or migration certification.

Those require project-specific execution and human review. MesaGuard's output is designed to make that review smaller and reproducible.

## Development

```bash
npm install
npm run check
```

The package has no runtime dependencies. The committed `dist/action.cjs` bundle is the executable GitHub Action.

## Evidence and versioning

Rules are sourced from the official o1js changelog and linked pull requests. Every report embeds those sources. Rule behavior follows semantic versioning: false-positive reductions are patches; new findings are minor releases; changed default failure behavior requires a major release.

## License

[MIT](LICENSE)
