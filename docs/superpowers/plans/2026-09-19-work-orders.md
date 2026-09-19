# Work Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มคำสั่งก่อนเลือกโรงพยาบาล พร้อมจัดการโรงพยาบาล เครื่องมือ ทีมจาก user และ PDF ผ่านแท็บคำสั่งสำหรับ admin และ technician

**Architecture:** Keep the existing Next.js application and MongoDB. Add separate order and attachment models, server-side authorization and validation, then connect the selected order to the hospital workspace and both calibration flows. Existing records retain their historical access and do not acquire an order automatically.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, NextAuth, Mongoose, Tailwind, existing Node test runner with sucrase.

**Spec:** `docs/superpowers/specs/2026-09-19-work-orders-design.md`

## Global Constraints

- admin และ technician จัดการทุกคำสั่งและไฟล์แนบได้ บังคับสิทธิ์ใน API ด้วย
- ทีมผู้ปฏิบัติงานที่เลือกจาก user ในระบบ
- จำกัด 8 MB ต่อไฟล์ ตรวจชนิด ขนาด และลายเซ็น PDF ก่อนบันทึก
- ประวัติเดิมที่ไม่มีคำสั่งยังเปิดดูได้ ไม่โยกประวัติย้อนหลังอัตโนมัติ
- เครื่องมือเดียวกันอยู่ในหลายคำสั่งได้สำหรับการออกปฏิบัติงานคนละรอบ
- ผู้ใช้โรงพยาบาลเห็นเฉพาะส่วนของโรงพยาบาลตนและยังคงข้อจำกัดเดิม
- Do not seed or modify live data to test this feature. Use an isolated test database and generated fixtures. Preserve unrelated local files, including recovery-codes.txt.

## Review Focus

1. A slow hospital-device response after switching hospitals must not replace the current selection (Task 3).
2. An inactive or deleted team member on an existing order must remain intelligible, while new selection requires active accounts (Tasks 1 and 3).
3. A remembered order from another login or impersonated account must never grant access (Task 4).
4. Duplicate AmedNo values in different hospitals must never attach the wrong instrument (Task 5).
5. Concurrent order edits and calibration creation must not allow removal of referenced instruments (Tasks 2 and 5).

## Shared Contract and File Map

Create `src/lib/workOrderTypes.ts` for public DTOs:

```ts
export type OrderHospital = { unitName: string; deviceIds: string[] }
export type WorkOrderInput = {
  orderNo: string; title: string; startDate: string; endDate: string
  notes: string; hospitals: OrderHospital[]; memberIds: string[]
}
export type WorkOrderSummary = WorkOrderInput & {
  _id: string; revision: number; updatedAt: string
  members: { _id: string; name: string; username: string; isActive: boolean }[]
}
```

API success responses use `{ data }`; errors use `{ error }`. List endpoints never return file bytes. IDs are MongoDB ObjectIds serialized to strings; unit names are normalized through existing `getUnitVariants`. Dates use YYYY-MM-DD. IDs, not names, link instruments and members.

New files by responsibility: models `WorkOrder.ts`, `WorkOrderDocument.ts`; validation `workOrderValidation.ts`; server operations `workOrderService.ts`; workspace storage `workspaceOrder.ts`; client context `OrderWorkspace.tsx`; administration `AdminWorkOrders.tsx`, `WorkOrderForm.tsx`, `WorkOrderDocuments.tsx`; selection page `app/orders/page.tsx` and layout. API routes live under `app/api/orders`.

## Task 1: Model and Validate Orders

**Files:** Create the two models, DTOs, validation module, `scripts/test-work-order-validation.ts`; modify `package.json`.

**Interfaces:** `validateWorkOrderInput(value: unknown): WorkOrderInput` throws a descriptive validation error; `canManageOrders(role?: string): boolean`; `validateOrderPdf(file: {type: string; size: number}, bytes: Uint8Array): void`.

- [ ] Write tests before implementation:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { canManageOrders, validateWorkOrderInput, validateOrderPdf } from '../src/lib/workOrderValidation'
test('management roles', () => {
  assert.equal(canManageOrders('admin'), true)
  assert.equal(canManageOrders('technician'), true)
  assert.equal(canManageOrders('hospital_user'), false)
  assert.equal(canManageOrders('approver'), false)
})
test('reject empty order', () => assert.throws(() => validateWorkOrderInput({})))
test('reject disguised PDF', () => assert.throws(() =>
  validateOrderPdf({type: 'application/pdf', size: 5}, new TextEncoder().encode('hello'))))
```

- [ ] Run `node -r sucrase/register --test scripts/test-work-order-validation.ts`; confirm missing-module failure. Check sucrase availability before adding any dependency; existing test commands depend on it.
- [ ] Implement required trimmed fields, real dates and ordering, nonempty distinct hospitals/devices/members, strict ObjectIds and PDF checks. Persist audit IDs and timestamps, member/device display snapshots, and revision. Add unique index on normalized orderNo; attachments have orderId, filename, contentType, pdfData, uploadedBy, uploadedAt. Keep bytes separate from WorkOrder.
- [ ] Extend tests with valid input, duplicate IDs, missing instruments, invalid dates, 8 MB boundary, and inactive-member policy: retain existing membership but disallow adding inactive accounts. Run tests until passing. Add `test:work-orders` script.
- [ ] Commit only task files with `feat: add work order models and validation`.

## Task 2: Authorized Order and PDF APIs

**Files:** Create `src/lib/workOrderService.ts`, `src/app/api/orders/route.ts`, `[id]/route.ts`, `options/route.ts`, `[id]/documents/route.ts`, `[id]/documents/[documentId]/route.ts`; create `scripts/test-work-order-service.ts`.

**Interfaces:** Service accepts authenticated actor `{id, role, hospitalUnit?}`. Expose list, get, create, update, delete, and attachment operations. PUT accepts `{...WorkOrderInput, revision}`. `GET /api/orders/options` returns safe user summaries and hospital choices for managers. HTTP statuses: 401 unauthenticated, 403 forbidden, 404 missing, 400 invalid data, 409 conflict, 413 oversized file.

- [ ] Write failing service tests using injected repositories or an isolated database. Required assertions include:

```ts
// Arrange an order referencing hospital A and a saved calibration.
assert.equal(updateRemovingReferencedDevice.status, 409)
assert.equal(deleteReferencedOrder.status, 409)
assert.equal(hospitalBRead.status, 404)
assert.equal(hospitalAResponse.data.hospitals.length, 1)
assert.equal(hospitalAPdfRead.status, 403)
assert.equal(technicianCreate.status, 201)
assert.equal(approverUpdate.status, 403)
assert.equal(staleRevisionUpdate.status, 409)
```

- [ ] Implement role checks before writes, safe field projection, DB verification of selected users/devices and hospital ownership, normalized duplicate-number handling, per-hospital read projection and PDF authorization. Never use client-supplied membership or unit name as proof of access.
- [ ] Serialize changes against record creation using a MongoDB transaction that updates the same WorkOrder revision document before changing relations; a conflict retries or returns 409. Check replica-set support in the test database. Do not silently weaken this invariant on unsupported deployment.
- [ ] Implement file upload via formData, PDF validation, metadata list, byte response with existing contentDisposition helper, and scoped deletion using both orderId and documentId. For order deletion remove attachments within the same transaction. Do not delete existing calibration records.
- [ ] Run role matrix, dangling-ID, cross-hospital, duplicate-number, stale-version, concurrent relation-removal and file round-trip tests. Commit as `feat: add authorized work order APIs`.

## Task 3: Administration Tab and Forms

**Files:** Modify `src/app/admin/page.tsx`, `src/components/AdminSubnav.tsx`; create `AdminWorkOrders.tsx`, `WorkOrderForm.tsx`, `WorkOrderDocuments.tsx`.

**Interfaces:** `WorkOrderForm({order, onSaved, onCancel})` consumes WorkOrderSummary or null. Documents consume saved orderId. Keep submit status separate from document-upload status.

- [ ] Add the tab using the existing route pattern:

```tsx
{ href: '/admin?tab=orders', label: 'คำสั่ง', tab: 'orders' }
// AdminPage:
{tab === 'orders' && <AdminWorkOrders />}
```

- [ ] Implement searchable order list, create/edit form, multi-hospital instrument selectors, multi-user selector, date fields and notes. Render device name, AmedNo, model and serial number; render member name plus username. Fetch choices using manager-only options API and existing instrument API. Abort or disregard obsolete device requests after switching hospitals.
- [ ] Preserve edits on server errors and display field errors in Thai. Require explicit user action to discard selections when removing a hospital. Show inactive historical members distinctly. Disable duplicate submissions. After metadata save, upload documents against returned ID so retry cannot create another order.
- [ ] Add PDF list with open/download/remove and filename/date. Show upload constraints and individual upload errors. Confirm destructive deletion in the UI and explain 409 without losing form content.
- [ ] Verify with fixtures as admin and technician: tab visibility, multi-selection, edit/reload, inactive members, slow-response race, failed upload retry, and desktop/mobile layout. Commit as `feat: add work order management tab`.

## Task 4: Select Order Before Hospital

**Files:** Create `src/components/OrderWorkspace.tsx`, `src/lib/workspaceOrder.ts`, `src/app/orders/page.tsx`, `src/app/orders/layout.tsx`; modify `providers.tsx`, `app/page.tsx`, `login/page.tsx`, `HospitalWorkspace.tsx`, `HospitalSidebar.tsx`, `Navbar.tsx`, and workspace page/layout guards.

**Interfaces:** `useOrderWorkspace()` exposes `{ orders, selectedOrder, selectOrder(id), loading, refreshOrders }`. Order context wraps HospitalWorkspaceProvider. Storage key `workspace-order` is only a selection hint; API validates all access.

- [ ] Write failing selection-helper tests for stale order, unauthorized order, changed session identity, and removal of selected hospital. Expected fallback is no selection, with access to `/orders` and `/admin?tab=orders`.
- [ ] Implement account-scoped selection, verify stored order against fetched visible orders, clear after logout/impersonation identity change, and cancel obsolete fetches. Intersect the order's hospitals with existing hospital-user restrictions.
- [ ] Redirect entry and successful login to `/orders`. Keep admin/profile and historical direct links accessible. Require valid selection for current workspaces; empty state links managers to create first order. Show order number and change-order action; hide hospital selection until order selected.
- [ ] Verify reload, direct navigation, logout/login as different role, impersonation, no-orders state, order edit refresh and mobile sidebar. Commit as `feat: add order selection workspace`.

## Task 5: Bind Instruments and New Calibration Work

**Files:** Modify `src/models/CalibrationRecord.ts`, `src/app/api/records/route.ts`, `src/app/api/records/[id]/route.ts`, `src/app/api/ameddevices/route.ts`, `src/app/hospital/page.tsx`, `src/components/DeviceSelector.tsx`, `src/app/records/new/page.tsx`, `src/components/CalibrationForm.tsx`, `src/components/IsoCalibrationForm.tsx`. Extend service and add `scripts/test-work-order-records.ts`.

**Interfaces:** New records include `workOrderId` and `workOrderDeviceId`; historical records can omit both. Instrument GET optionally accepts `workOrderId`, applying authorized order scope when present. Server record creation always requires and verifies the selected order and instrument for new work; edits derive the association from the existing record and prohibit reassignment.

- [ ] Write failing integration tests for missing order, unauthorized order, hospital mismatch, duplicate AmedNo in different hospitals, both ISO/SBCAL creation paths, existing historical edits, and forbidden association removal.
- [ ] Send selected context from both draft-creation paths and both full forms:

```ts
const orderFields = {
  workOrderId: selectedOrder._id,
  workOrderDeviceId: selectedDevice._id,
}
// Merge into existing create payload; preserve saveAction and numbering behavior.
```

- [ ] Validate linked device by registry ID and normalized hospital; snapshot identifying fields server-side. Acquire order revision in the same transaction as record creation. Update unsaved-draft reuse query to include order/device IDs so switching orders cannot reuse another order's draft.
- [ ] Scope hospital instrument display and DeviceSelector using the order. Keep historical instrument records and certificate access governed by existing permissions, without filtering away pre-order records. Lock identifying fields for linked instruments or reject edits that diverge from the registry association.
- [ ] Run new tests and existing record lifecycle, record step, personnel, document actions, PDF certificate, and content-disposition tests. Verify cert numbering still occurs at approval. Commit as `feat: associate calibration work with orders`.

## Task 6: End-to-End Verification and Delivery

**Files:** Update README with entry flow, manager roles, file limit and test command; update this checklist as tasks pass.

- [ ] Run `npm run test:work-orders` and relevant existing tests. Run `npx tsc --noEmit` and `npm run build`, using an isolated checkout/port so build output does not corrupt the running dev server. Record pre-existing failures separately and fix regressions introduced by this feature.
- [ ] In an isolated test database create two hospitals, same-number instruments, admin, technician, approver, hospital user and two orders. Verify full create/edit/select/calibrate/reopen/PDF flow and role restrictions, including raw API access.
- [ ] Verify concurrent removal versus record creation leaves a consistent order; unauthorized PDF requests disclose no bytes; stale selections never cross account boundaries; historical records remain accessible.
- [ ] Inspect desktop and narrow mobile layouts, empty/loading/error states, and server logs. Remove only generated test fixtures. Review the feature diff and resolve actionable findings before declaring completion.
- [ ] Commit verified feature documentation, run the finished app and provide a link to the command tab. Report what passed and any unverified limitation without claiming broader verification.

## Execution Handoff

Recommend native execution in this task because the workspace, authorization, and two calibration flows share interfaces and benefit from one continuous implementation context. Alternative: subagent-driven implementation with independent per-task reviews. User reviews this plan and chooses the method before product code changes.
