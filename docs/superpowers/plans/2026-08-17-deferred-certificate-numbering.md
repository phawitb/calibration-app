# Deferred Certificate Numbering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent certificate-number gaps and inaccessible work by reusing unsaved calibration records, assigning numbers only on approval submission, and excluding unsaved records from Dashboard data.

**Architecture:** Put record-lifecycle decisions in pure helpers that can be tested without MongoDB. The records POST route uses the matching query before creating a temporary record, the records PUT route uses the number-assignment decision after approval validation, and Dashboard derives all queries from a saved-record scope.

**Tech Stack:** Next.js 14 App Router, TypeScript, Mongoose, Node test runner, Sucrase

## Global Constraints

- Saving a draft must not assign a certificate number.
- Only a validated `request_approval` action may assign the first certificate number.
- Existing certificate numbers must never be replaced.
- Unsaved records must remain stored but must not appear in Dashboard lists, counts, trends, or aggregations.
- Existing untracked files outside this feature remain untouched.

---

## File structure

- Create `src/lib/recordLifecycle.ts`: pure matching, numbering, and saved-record-scope decisions.
- Create `scripts/test-record-lifecycle.ts`: regression coverage for those decisions.
- Modify `package.json`: add a focused test script.
- Modify `src/app/api/records/route.ts`: reuse a matching unsaved record and create temporary records without numbers.
- Modify `src/app/api/records/[id]/route.ts`: assign certificate and AMED key only on the first valid approval request.
- Modify `src/app/dashboard/page.tsx`: base all Dashboard data on saved records.

### Task 1: Record lifecycle decision helpers

**Files:**
- Create: `src/lib/recordLifecycle.ts`
- Create: `scripts/test-record-lifecycle.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `buildUnsavedDraftQuery(input): Record<string, unknown>` for the POST lookup.
- Produces `shouldAssignCertificateNumber(saveAction: string, certNo: unknown): boolean` for PUT.
- Produces `stripClientNumberFields<T extends Record<string, unknown>>(patch: T): Omit<T, 'certNo' | 'amedCertKey'>` for protecting server-owned numbers.
- Produces `withSavedRecords<T extends Record<string, unknown>>(scope: T): T & { savedOnce: { $ne: false } }` for Dashboard.

- [ ] **Step 1: Write failing helper tests**

Cover these literal cases with `node:test` and `node:assert/strict`:

```ts
assert.deepEqual(buildUnsavedDraftQuery({
  createdBy: 'tech1', unitName: 'Hospital A', calibrationType: 'sbcal', amedNo: '11299555',
}), {
  createdBy: 'tech1', unitName: 'Hospital A', calibrationType: 'sbcal',
  amedNo: '11299555', savedOnce: false,
})

assert.deepEqual(buildUnsavedDraftQuery({
  createdBy: 'tech1', unitName: 'Hospital A', calibrationType: 'iso', isoMethodCode: 'TEM-004',
}), {
  createdBy: 'tech1', unitName: 'Hospital A', calibrationType: 'iso',
  isoMethodCode: 'TEM-004', savedOnce: false,
})

assert.equal(shouldAssignCertificateNumber('draft', ''), false)
assert.equal(shouldAssignCertificateNumber('request_approval', ''), true)
assert.equal(shouldAssignCertificateNumber('request_approval', 'CERT-000150/2026'), false)
assert.deepEqual(withSavedRecords({ createdBy: 'tech1' }), {
  createdBy: 'tech1', savedOnce: { $ne: false },
})
```

Also assert that missing SbCal AMED No. and missing ISO method code return `null`, so unrelated temporary records cannot match.

Add:

```json
"test:record-lifecycle": "node -r sucrase/register --test scripts/test-record-lifecycle.ts"
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test:record-lifecycle`

Expected: FAIL because `src/lib/recordLifecycle.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

Normalize all matching string inputs with `String(value || '').trim()`. Return `null` when creator, hospital, calibration type, or type-specific identity is missing. `withSavedRecords` must preserve the caller's fields and force `savedOnce: { $ne: false }`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test:record-lifecycle`

Expected: all lifecycle helper tests pass.

### Task 2: Reuse temporary records and defer numbering

**Files:**
- Modify: `src/app/api/records/route.ts:150-225`
- Modify: `src/app/api/records/[id]/route.ts:57-185`
- Modify: `scripts/test-record-lifecycle.ts`

**Interfaces:**
- Consumes the helpers from Task 1.
- POST returns `{ record, reused: true }` with status 200 for a match and `{ record, reused: false }` with status 201 for a new temporary record.
- PUT returns the existing `{ record }` shape.

- [ ] **Step 1: Add failing tests for route-level decisions**

Add tests for the not-yet-implemented `stripClientNumberFields` helper:

```ts
assert.deepEqual(stripClientNumberFields({
  deviceName: 'Thermometer',
  certNo: 'CLIENT-CERT',
  amedCertKey: 'CLIENT-KEY',
}), { deviceName: 'Thermometer' })
```

Name the test `removes client-supplied server-owned numbering fields` so the production regression it catches is explicit.

- [ ] **Step 2: Verify the new tests fail for the missing behavior**

Run: `npm run test:record-lifecycle`

Expected: FAIL because `stripClientNumberFields` is not exported.

- [ ] **Step 3: Update POST to reuse or create without numbering**

After hospital normalization, build the unsaved-draft query from the current username and normalized request identity. When it is non-null, run `CalibrationRecord.findOne(query).sort({ createdAt: -1 })`; return it immediately with `reused: true` when found. Remove `generateNextCertNo`, `generateNextAmedCertKey`, and `registerAmedCertForRecord` from POST creation. Store no `certNo` or `amedCertKey` on a new temporary record and return `reused: false`.

- [ ] **Step 4: Update PUT to number only on approval submission**

Implement `stripClientNumberFields`, then use it when constructing the PUT patch. After all request-approval role and approver validation has passed, call `shouldAssignCertificateNumber(action, existing.certNo)`. When true, set `patch.certNo = await generateNextCertNo(rawBody.issuedDate || rawBody.calDate || existing.issuedDate || existing.calDate)`. Generate a missing AMED certificate key in the same first-approval branch. Client-supplied `certNo` and `amedCertKey` never reach the patch. Preserve existing values on approval resubmission. Keep AMED history registration after persistence and only when both AMED No. and certificate number exist.

- [ ] **Step 5: Run focused tests and build**

Run:

```bash
npm run test:record-lifecycle
npm run build
```

Expected: tests pass and Next.js compilation/type checking succeeds.

### Task 3: Exclude unsaved records from Dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx:100-340`
- Modify: `scripts/test-record-lifecycle.ts`

**Interfaces:**
- Consumes `withSavedRecords(scope)` from Task 1.
- Produces a Dashboard where every record query, count, and aggregation inherits `savedOnce: { $ne: false }`.

- [ ] **Step 1: Add a failing saved-scope composition test**

Assert that hospital, technician, and status predicates survive composition and that any incoming `savedOnce` value is replaced by `{ $ne: false }`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:record-lifecycle`

Expected: the new composition case fails until `withSavedRecords` enforces the visibility rule.

- [ ] **Step 3: Apply the saved-record scope once**

After building the existing role/hospital `scope`, replace it with a saved-only base scope via `withSavedRecords(scope)`. Ensure every downstream `find`, `countDocuments`, and aggregate `$match` uses that base scope, including cards, work lists, recents, trends, and top summaries.

- [ ] **Step 4: Run full verification**

Run every `test:*` script in `package.json`, then:

```bash
npm run build
git diff --check
```

Expected: all tests pass, the build exits 0, and no whitespace errors are reported.

- [ ] **Step 5: Commit and push approved changes**

Inspect and stage only the feature files, then commit:

```bash
git add package.json scripts/test-record-lifecycle.ts src/lib/recordLifecycle.ts src/app/api/records/route.ts 'src/app/api/records/[id]/route.ts' src/app/dashboard/page.tsx
git commit -m "fix: defer certificate numbering until approval"
git push origin main
```
