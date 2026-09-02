# Agent operating guide

## Start here

1. Read `README.md` and `docs/ai/AI_CONTEXT.md` before changing code. Completion: the requested change is mapped to named modules and invariants.
2. Read the branch-specific source of truth:
   - Product scope or UI: `docs/01-product-requirements.md`, `docs/05-ui-ux.md`.
   - Posting, inventory, cost, receivables/payables: `docs/02-business-processes.md`, `docs/04-data-model.md`.
   - Architecture or dependency changes: `docs/03-architecture.md` and relevant ADRs; add an ADR for a material reversal.
   - Security, permissions, exports, secrets, backup: `docs/06-security-audit-backup.md`.
   - Deployment or release: `docs/08-testing-acceptance.md`, `docs/09-deployment-operations.md`.
   - Review or risk assessment: `docs/ai/REVIEW_CHECKLIST.md`, `docs/ai/KNOWN_RISKS.md`.
3. Inspect the current code, tests, toolchain files and working tree; treat them as the current implementation truth. Completion: affected paths and pre-existing changes are accounted for.
4. Implement the smallest complete vertical change. Keep business rules server-authoritative and modules cohesive.
5. Run the narrow relevant tests, then the repository quality gates. Completion: every affected invariant has evidence or an explicitly reported unverified item.
6. Update the source-of-truth document when behavior, API, schema, operations or decisions change.

## Ledger guardrails

- Posted documents are immutable; corrections use reversal/adjustment records with actor, reason and source.
- PostgreSQL is the formal ledger. Client SQLite holds caches and drafts only.
- Inventory, receivable and payable balances reconcile to posted ledger entries.
- Posting is one authorized, idempotent database transaction covering document state, ledgers, balance snapshots, audit and outbox.
- Money uses decimal/fixed-point arithmetic with explicit rounding. Unit conversions use exact ratios.
- Concurrency protects the final available stock and allocation amounts; retries never duplicate effects.
- API authorization is authoritative. UI visibility is only a usability layer.

## Evidence

Report separately: code/build evidence, automated test evidence, migration/restore evidence, and real device/user validation. A successful build is not proof that posting, printing, scanning, offline recovery or financial reconciliation works.

## Scope

Preserve working behavior outside the request. Surface a scope decision when it changes accounting policy, offline posting, data ownership, external systems or production operations; do not infer that expansion.
