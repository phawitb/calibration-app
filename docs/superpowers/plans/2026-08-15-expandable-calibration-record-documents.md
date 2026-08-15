# Expandable Calibration Record Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each `/records` table row expand into an accessible inline panel with calibration, calibrator, and approver document actions.

**Architecture:** Add a focused, framework-independent helper module for row activation and personnel-certificate selection, then integrate it into the existing client page. Extend the existing records API projection with the two user IDs required by the personnel-certificate actions; expanding a row itself performs no network request.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Node.js built-in test runner, Sucrase.

## Global Constraints

- Only one record row may be expanded at a time.
- Enter and Space activate a focused record row.
- Links, buttons, inputs, selects, textareas, and elements marked with `data-row-action` must not toggle a row.
- Personnel certificate buttons are hidden when their corresponding user ID is absent.
- Documents open in a new browser tab.
- Do not change permissions, the PDF viewer, certificate upload behavior, or the medical-device page.
- Do not add a new runtime or test dependency.

---

### Task 1: Tested record-document interaction helpers

**Files:**
- Create: `src/lib/recordDocumentActions.ts`
- Create: `scripts/test-record-document-actions.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `nextExpandedRecordId(currentId: string | null, clickedId: string): string | null`
- Produces: `isRecordRowActivationKey(key: string): boolean`
- Produces: `isRecordRowActionTarget(target: EventTarget | null): boolean`
- Produces: `firstPersonnelCertificateUrl(userId: string, payload: unknown): string | null`

- [ ] **Step 1: Write the failing helper test**

Create `scripts/test-record-document-actions.ts` with Node assertions covering the break each helper prevents:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  firstPersonnelCertificateUrl,
  isRecordRowActionTarget,
  isRecordRowActivationKey,
  nextExpandedRecordId,
} from '../src/lib/recordDocumentActions'

test('clicking a collapsed row expands it and clicking it again collapses it', () => {
  assert.equal(nextExpandedRecordId(null, 'record-a'), 'record-a')
  assert.equal(nextExpandedRecordId('record-a', 'record-a'), null)
})

test('clicking another row replaces the currently expanded row', () => {
  assert.equal(nextExpandedRecordId('record-a', 'record-b'), 'record-b')
})

test('only Enter and Space activate a focused record row', () => {
  assert.equal(isRecordRowActivationKey('Enter'), true)
  assert.equal(isRecordRowActivationKey(' '), true)
  assert.equal(isRecordRowActivationKey('Escape'), false)
})

test('interactive action targets do not toggle their record row', () => {
  const actionTarget = { closest: (selector: string) => selector.includes('button') ? {} : null }
  const plainTarget = { closest: () => null }
  assert.equal(isRecordRowActionTarget(actionTarget as unknown as EventTarget), true)
  assert.equal(isRecordRowActionTarget(plainTarget as unknown as EventTarget), false)
})

test('the first personnel certificate is converted to its download URL', () => {
  assert.equal(
    firstPersonnelCertificateUrl('user-1', { data: [{ _id: 'cert-1' }, { _id: 'cert-2' }] }),
    '/api/users/user-1/certificates/cert-1',
  )
})

test('missing or malformed personnel certificates produce no URL', () => {
  assert.equal(firstPersonnelCertificateUrl('user-1', { data: [] }), null)
  assert.equal(firstPersonnelCertificateUrl('user-1', { data: [{}] }), null)
  assert.equal(firstPersonnelCertificateUrl('', { data: [{ _id: 'cert-1' }] }), null)
})
```

Add the script to `package.json`:

```json
"test:record-documents": "node -r sucrase/register --test scripts/test-record-document-actions.ts"
```

- [ ] **Step 2: Run the helper test and verify RED**

Run: `npm run test:record-documents`

Expected: FAIL because `src/lib/recordDocumentActions.ts` does not exist.

- [ ] **Step 3: Implement the minimal helpers**

Create `src/lib/recordDocumentActions.ts`:

```ts
type ClosestTarget = EventTarget & { closest?: (selector: string) => unknown }

export function nextExpandedRecordId(currentId: string | null, clickedId: string) {
  return currentId === clickedId ? null : clickedId
}

export function isRecordRowActivationKey(key: string) {
  return key === 'Enter' || key === ' '
}

export function isRecordRowActionTarget(target: EventTarget | null) {
  const closest = (target as ClosestTarget | null)?.closest
  return typeof closest === 'function'
    ? Boolean(closest.call(target, 'a, button, input, select, textarea, [data-row-action]'))
    : false
}

export function firstPersonnelCertificateUrl(userId: string, payload: unknown) {
  const data = (payload as { data?: Array<{ _id?: unknown }> } | null)?.data
  const certificateId = Array.isArray(data) ? data[0]?._id : null
  if (!userId || typeof certificateId !== 'string' || !certificateId) return null
  return `/api/users/${userId}/certificates/${certificateId}`
}
```

- [ ] **Step 4: Run the helper test and verify GREEN**

Run: `npm run test:record-documents`

Expected: 6 tests pass and the command exits with status 0.

- [ ] **Step 5: Commit the helper deliverable**

```bash
git add package.json scripts/test-record-document-actions.ts src/lib/recordDocumentActions.ts
git commit -m "test: cover expandable record document actions"
```

### Task 2: Records API data and expandable row UI

**Files:**
- Modify: `src/app/api/records/route.ts` in the GET projection
- Modify: `src/app/records/page.tsx` in the row type, page state, document handler, and table body

**Interfaces:**
- Consumes: all four exports from `src/lib/recordDocumentActions.ts`
- Consumes: `/api/users/{userId}/certificates` response shaped as `{ data: Array<{ _id: string }> }`
- Produces: `CalibrationRecordRow.calibratedById?: string` and `CalibrationRecordRow.approvedById?: string`

- [ ] **Step 1: Extend the list data contract**

Add `calibratedById approvedById` to the existing `.select(...)` projection in `src/app/api/records/route.ts`. Add matching optional string fields to `CalibrationRecordRow` in `src/app/records/page.tsx`.

- [ ] **Step 2: Add state and personnel-certificate opening behavior**

Import the Task 1 helpers. Add:

```ts
const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)

const openPersonnelCertificate = async (userId: string, roleLabel: string) => {
  try {
    const res = await fetch(`/api/users/${userId}/certificates`)
    if (!res.ok) throw new Error(`certificate list request failed: ${res.status}`)
    const url = firstPersonnelCertificateUrl(userId, await res.json())
    if (!url) {
      toast.error(`${roleLabel}ยังไม่มีใบเซอร์`)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    toast.error(`ไม่สามารถโหลดใบเซอร์${roleLabel}ได้`)
  }
}
```

- [ ] **Step 3: Make the primary table row accessible and expandable**

Wrap each mapped record in a keyed fragment so the primary and detail rows are siblings. On the primary `<tr>`:

- set `role="button"`, `tabIndex={0}`, and `aria-expanded={expandedRecordId === r._id}`;
- use a pointer cursor and visible `focus-visible` ring;
- on click, return early when `isRecordRowActionTarget(event.target)` is true, otherwise call `setExpandedRecordId(current => nextExpandedRecordId(current, r._id))`;
- on key down, ignore action targets and keys other than Enter/Space, prevent the browser's default action, and toggle using the same state function; and
- add a chevron in the management cell that rotates when expanded.

Keep View/Edit, PDF, and Delete actions unchanged. Their interactive elements are excluded by `isRecordRowActionTarget`.

- [ ] **Step 4: Render the expanded document panel**

When `expandedRecordId === r._id`, render a second `<tr>` with `colSpan={11}`. The panel must show `ผู้สอบเทียบ: {r.calibrate || '-'}` and `ผู้อนุมัติ: {r.approve || '-'}` plus:

```tsx
<a href={`/records/${r._id}/pdf`} target="_blank" rel="noopener noreferrer">
  ใบรับรอง
</a>
{r.calibratedById && (
  <button type="button" onClick={() => openPersonnelCertificate(r.calibratedById!, 'ผู้สอบเทียบ')}>
    เซอร์ผู้สอบ
  </button>
)}
{r.approvedById && (
  <button type="button" onClick={() => openPersonnelCertificate(r.approvedById!, 'ผู้อนุมัติ')}>
    เซอร์ผู้อนุมัติ
  </button>
)}
```

Use the existing military, blue, and green outlined button styles from Medical Device Information > Documents, and allow the action row to wrap on narrow screens.

- [ ] **Step 5: Run focused tests and build verification**

Run:

```bash
npm run test:record-documents
npm run build
```

Expected: all 6 focused tests pass; Next.js build and TypeScript checks complete with exit status 0.

- [ ] **Step 6: Verify behavior in the running browser**

On `http://localhost:3000/records`, verify:

1. Click a row: its inline document panel opens.
2. Click the same row: it closes.
3. Open a second row: the first closes.
4. Focus a row and press Enter and Space: both toggle it.
5. Click View/Edit, PDF, and Delete: the row does not toggle.
6. Calibration Certificate opens the correct `/records/{id}/pdf` page.
7. Personnel certificate buttons appear only when their IDs exist.
8. A valid personnel certificate opens in a new tab; an empty list and failed request show the correct Thai toast.
9. At a narrow viewport, the panel and buttons remain readable and wrap without horizontal clipping.

- [ ] **Step 7: Commit the integrated feature**

```bash
git add src/app/api/records/route.ts src/app/records/page.tsx
git commit -m "feat: expand calibration records with documents"
```

### Task 3: Final regression check

**Files:**
- No production files should change unless verification finds a defect; any defect must start a new failing test before its fix.

**Interfaces:**
- Consumes: the completed `/records` UI and focused test command.
- Produces: verified feature behavior without unrelated working-tree changes.

- [ ] **Step 1: Re-run all relevant verification**

Run:

```bash
npm run test:record-documents
npm run test:iso-liquid-bath
npm run build
git diff --check HEAD~2..HEAD
git status --short --branch
```

Expected: both test commands and build pass; diff check is clean; only the pre-existing untracked spreadsheet lock files and `recovery-codes.txt` remain outside Git.

- [ ] **Step 2: Confirm commit scope**

Run: `git show --stat --oneline HEAD~2..HEAD`

Expected: commits contain only the helper/test files, package script, records API projection, and records page UI described above.
