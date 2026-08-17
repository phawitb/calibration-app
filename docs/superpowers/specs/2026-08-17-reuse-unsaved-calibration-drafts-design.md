# Deferred Certificate Number and Unsaved Draft Reuse Design

## Problem

Selecting a device or ISO method immediately creates a calibration record and reserves a certificate number. Navigating back before the first save leaves that number on a hidden record that cannot be opened from the records page. Selecting the same item again creates another hidden record and reserves another number. These `savedOnce: false` records also currently appear in Dashboard work lists and statistics.

## Required behavior

- Before creating a record, look for the current user's most recent matching record with `savedOnce: false`.
- For SbCal, a match requires the same creator, normalized hospital, calibration type, and AMED No.
- For ISO, a match requires the same creator, normalized hospital, calibration type, and ISO method code.
- If a match exists, return and reopen that record without generating a new certificate number or AMED certificate key.
- If no match exists, create a temporary record without a certificate number.
- A record with `savedOnce: true` never qualifies for reuse; selecting the same device or method starts a genuinely new calibration.
- Saving a draft sets `savedOnce: true` and keeps the normal edit flow, but does not assign a certificate number.
- Assign the certificate number only when `saveAction` is `request_approval`, after authorization, approver, and request validation pass.
- If submission fails validation or persistence, do not consume a certificate number.
- A record that already has a certificate number keeps that number on later saves or approval resubmissions.
- Dashboard queries, counts, trends, queues, and lists must exclude `savedOnce: false` records.
- Existing unsaved records remain stored; this change does not delete data.

## Architecture

Keep the decision on the server so double clicks, multiple tabs, and different clients share one rule. Extract a pure query builder that creates the safe draft-reuse filter, then have `POST /api/records` check that filter before creating a temporary record. Return the existing response shape plus a `reused` boolean for observability.

Remove certificate-number generation and AMED certificate-history registration from initial record creation. In `PUT /api/records/[id]`, generate a number only on the validated `request_approval` path when the existing record has no number. Register AMED certificate history only after a number exists.

Define the Dashboard's base scope with `savedOnce: { $ne: false }` so every derived query and aggregation inherits the same exclusion rule.

## Safety and concurrency

The reuse lookup occurs before temporary-record creation. The existing client-side `creating` guard remains in place. No saved, submitted, rejected, or approved record can be reused because all have `savedOnce: true` after their first save. Number generation occurs only after request-approval validation and must never overwrite an existing number.

## Verification

- A matching unsaved SbCal record is reused.
- A matching unsaved ISO record is reused.
- Different users, hospitals, AMED numbers, ISO methods, and saved records do not match.
- Initial creation and draft saves do not call certificate-number generation.
- A successful first approval request assigns one certificate number.
- Approval resubmission preserves the existing certificate number.
- A failed approval request does not assign a certificate number.
- Dashboard base scope excludes `savedOnce: false` records and all derived data uses that scope.
- Existing tests and the production build remain green.
