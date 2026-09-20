# Standard instrument years implementation plan

**Goal:** Complete annual reference snapshots, latest-year selection, preview-confirm retrospective record/PDF updates retaining approval and certificate number.
**Architecture:** Immutable annual revisions; server reference projection and provenance in record snapshots; transactional per-record updates and archived prior PDFs. Independent annual UI and shared PDF renderer built in parallel.
**Spec:** ../specs/2026-09-19-standard-instrument-years-design.md

## Constraints
- Preserve actual measured readings; ambiguous historical matching is manual review, never guessed.
- Existing records do not silently acquire latest-year values. New selections do.
- Check update is read-only; confirmed updates preserve certificate numbers and approval.
- Do not modify production data while testing. Use isolated MongoDB replica set.

## Tasks
- [x] Annual snapshot model/service/API: normalized years, optimistic revisions, full fields/tables/PDF, legacy preview, latest projection. Test years, duplicate conflicts, legacy adoption.
- [x] Parent: record provenance from both forms and server defaults, exact-version calpoint loading, guard old route bypasses.
- [x] Annual UI agent: year selector/copy/edit/PDF and preview-confirm update table with per-item results/history.
- [x] PDF agent: shared document, calculation service, real server rendering and stale browser archive payload guard.
- [x] Parent: impact preview and transactional record/history/PDF update with optimistic checks. Test matching, unchanged/manual readings, concurrency, rollback, idempotence and preserved approval.
- [x] Integration: typecheck, existing relevant tests, isolated persistence/update tests, real PDF generation and extracted-content checks, review changes.

## Review focus
- Editing old year must not make it newest; PDF revisions must not switch year.
- Legacy PDFs do not establish full historical standard values.
- Multiple uses of same standard across UC slots update consistently.
- Obsolete preview/PDF uploads and concurrent record edits cannot overwrite latest revision.
- PDF failure must leave issued record and current archive unchanged.

## Verification completed
- Production build and TypeScript checks passed.
- Isolated replica-set persistence and HTTP workflow passed (5 tests), including real PDF regeneration, preserved approval/number, historical PDF download, stale browser rejection, concurrent saves and rollback.
- Relevant UI/form/UC/PDF/lifecycle checks passed (37 tests); work-order regression suite passed (11 tests).
- No production data was migrated or changed. Existing instrument data requires an explicit year before annual use. Historical records with ambiguous year or manually measured STD values are listed for review rather than overwritten.
