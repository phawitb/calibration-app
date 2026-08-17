# PDF Certificate Labels and Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the calibration-certificate PDF labels and layout, and display every PDF date as `DD Mmm YYYY` without a time component.

**Architecture:** Add a small pure date-formatting module so date behavior is deterministic and directly testable. Update the existing React PDF component to use that formatter for every date field and make only the requested label and row-order changes.

**Tech Stack:** TypeScript, React 18, `@react-pdf/renderer`, Node test runner, Sucrase

## Global Constraints

- Update only the generated calibration certificate PDF.
- Forms, record lists, reports, stored data, and API behavior remain unchanged.
- Every displayed PDF date uses `DD Mmm YYYY`, for example `01 Aug 2026`.
- Missing or invalid dates display `-`.
- Preserve the existing PDF structure and styling except for relocating the `Hospital No.` row.

---

## File structure

- Create `src/lib/pdfDate.ts`: pure PDF date parsing and formatting only.
- Create `scripts/test-pdf-certificate.ts`: regression tests for date behavior and the PDF certificate labels/layout wiring.
- Modify `src/components/PdfViewer.tsx`: requested PDF labels, row position, and formatter usage.
- Modify `package.json`: focused `test:pdf-certificate` command.

### Task 1: Deterministic PDF date formatter

**Files:**
- Create: `src/lib/pdfDate.ts`
- Create: `scripts/test-pdf-certificate.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `unknown` date values supplied by calibration records and reference-standard records.
- Produces: `formatPdfDate(value: unknown): string`, returning `DD Mmm YYYY` or `-`.

- [ ] **Step 1: Write the failing formatter tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPdfDate } from '../src/lib/pdfDate'

test('formats a date-only value as DD Mmm YYYY', () => {
  assert.equal(formatPdfDate('2026-08-01'), '01 Aug 2026')
})

test('removes the time from a date-time value', () => {
  assert.equal(formatPdfDate('2026-08-01T14:35:22.000Z'), '01 Aug 2026')
})

test('returns a dash for missing and invalid dates', () => {
  assert.equal(formatPdfDate(''), '-')
  assert.equal(formatPdfDate(null), '-')
  assert.equal(formatPdfDate('not-a-date'), '-')
})
```

Add this script to `package.json`:

```json
"test:pdf-certificate": "node -r sucrase/register --test scripts/test-pdf-certificate.ts"
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:pdf-certificate`

Expected: FAIL because `src/lib/pdfDate.ts` does not exist.

- [ ] **Step 3: Implement the minimal formatter**

```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function formatPdfDate(value: unknown): string {
  if (!value) return '-'
  const dateOnly = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value as string | number | Date)
  if (Number.isNaN(date.getTime())) return '-'
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:pdf-certificate`

Expected: 3 tests pass and 0 fail.

- [ ] **Step 5: Commit the formatter**

```bash
git add src/lib/pdfDate.ts scripts/test-pdf-certificate.ts package.json
git commit -m "test: cover PDF certificate date formatting"
```

### Task 2: PDF labels, row placement, and date wiring

**Files:**
- Modify: `src/components/PdfViewer.tsx:1-410`
- Modify: `scripts/test-pdf-certificate.ts`

**Interfaces:**
- Consumes: `formatPdfDate(value: unknown): string` from `src/lib/pdfDate.ts`.
- Produces: certificate PDF content with corrected labels, upper-table Hospital No., and consistently formatted dates.

- [ ] **Step 1: Add failing certificate-source regression tests**

Read `src/components/PdfViewer.tsx` in the test and assert the exact wiring and order:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'

const pdfSource = readFileSync(path.join(process.cwd(), 'src/components/PdfViewer.tsx'), 'utf8')

test('uses the corrected PDF labels', () => {
  assert.match(pdfSource, /l1="Manufacturer"/)
  assert.match(pdfSource, /l1="Received No\."/)
  assert.match(pdfSource, />Manufacturer<\/Text>/)
  assert.match(pdfSource, />Measure Unit<\/Text>/)
  assert.doesNotMatch(pdfSource, /l1="Manufacture"|l1="Received N"|>Manufacture<\/Text>|>Meausre Unit<\/Text>/)
})

test('places Hospital No. in the upper device table', () => {
  const upperTableStart = pdfSource.indexOf('{/* Device info table */}')
  const customerTableStart = pdfSource.indexOf('{/* Customer info table */}')
  const upperTable = pdfSource.slice(upperTableStart, customerTableStart)
  const customerTableEnd = pdfSource.indexOf('{/* Calibration method */}')
  const customerTable = pdfSource.slice(customerTableStart, customerTableEnd)
  assert.match(upperTable, /InfoRowFull label="Hospital No\."/)
  assert.doesNotMatch(customerTable, /Hospital No\./)
  assert.ok(upperTable.indexOf('Hospital No.') > upperTable.indexOf('Serial No.'))
})

test('routes every PDF date field through formatPdfDate', () => {
  for (const expression of [
    'formatPdfDate(r.issuedDate)',
    'formatPdfDate(r.receivedDate)',
    'formatPdfDate(r.calDate)',
    'formatPdfDate(std1.calDate)',
    'formatPdfDate(sec.std.calDate)',
  ]) assert.ok(pdfSource.includes(expression), `missing ${expression}`)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:pdf-certificate`

Expected: formatter tests pass; label, layout, and formatter-wiring tests fail on the old PDF component.

- [ ] **Step 3: Make the minimal PDF component changes**

- Import `formatPdfDate` from `@/lib/pdfDate` and remove the local `fmtDate` function.
- Change both `Manufacture` headings to `Manufacturer`.
- Change `Received N` to `Received No.`.
- Change `Meausre Unit` to `Measure Unit`.
- Move `<InfoRowFull label="Hospital No." ... />` below the `Serial No. / Amed No.` device row and remove it from the customer table.
- Replace the three page-one calls to `fmtDate` with `formatPdfDate`.
- Replace `f(std1.calDate)` and `f(sec.std.calDate)` with `formatPdfDate(...)`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test:pdf-certificate`

Expected: 6 tests pass and 0 fail.

- [ ] **Step 5: Run full verification**

Run every existing `test:*` script from `package.json`, followed by:

```bash
npm run build
git diff --check
```

Expected: all commands exit 0 with no test failures, build errors, or whitespace errors.

- [ ] **Step 6: Inspect the final diff and commit**

```bash
git diff -- src/components/PdfViewer.tsx src/lib/pdfDate.ts scripts/test-pdf-certificate.ts package.json
git add src/components/PdfViewer.tsx src/lib/pdfDate.ts scripts/test-pdf-certificate.ts package.json
git commit -m "fix: update PDF certificate labels and dates"
```
