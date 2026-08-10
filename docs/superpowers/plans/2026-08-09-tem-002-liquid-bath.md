# TEM-002 Liquid Bath Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Water bath_PT2.67.xlsm` Liquid Bath workflow with equivalent web input, calculation, validation, and PDF output.

**Architecture:** Keep `TEM-002` on the existing universal ISO path, but isolate workbook-specific normalization and result shaping in the ISO calculation engine. Store UUC, five-sensor, and vertical readings in the calibration-point schema; have the API normalize all values and return one result object consumed by both the calculation page and PDF builder.

**Tech Stack:** Next.js 14, React, TypeScript, Mongoose, `@react-pdf/renderer`, existing ISO method-template engine.

## Global Constraints

- The first release is limited to Liquid Bath; other ISO methods retain their current contracts and behavior.
- The default workbook-compatible sizes are 15 UUC/sensor readings and 11 vertical readings.
- No PDF-only formulas; PDF consumes the calculation result object.
- Existing ISO records without optional new fields remain readable.
- Empty/malformed cells are ignored for statistics and produce validation errors when required.
- Verify fixtures for `44.5°C` and `95°C` against the workbook with explicit tolerances.

---

### Task 1: Create deterministic workbook fixtures and calculation tests

**Files:**
- Create: `scripts/fixtures/tem-002-water-bath.json`
- Create: `scripts/test-iso-liquid-bath.ts`
- Modify: `package.json` (add `test:iso-liquid-bath` script)

**Interfaces:**
- Consumes: `calculateIsoUncertainty(input: IsoCalcInput)` from `src/lib/isoUncertainty.ts`.
- Produces: repeatable assertions for point statistics and uncertainty values at `44.5` and `95`.

- [ ] **Step 1: Extract fixture inputs from `old-methods/Water bath_PT2.67.xlsm`**
  Store the two points, 5-sensor matrices, 15 UUC readings, 11 vertical readings, UUC resolution, standard parameters, and expected workbook outputs in JSON.
- [ ] **Step 2: Add failing assertions**
  Assert sensor means, stability, uniformity, vertical uniformity, overall variation, UUC mean/repeatability, `uc`, `kp`, and reported uncertainty using workbook-derived tolerances.
- [ ] **Step 3: Run the fixture test and record failures**
  Run `npm run test:iso-liquid-bath`; confirm failures identify formula/input mismatches rather than missing fixture data.
- [ ] **Step 4: Keep the test executable without a new test framework**
  Use the existing TypeScript toolchain or a small Node-compatible runner already present in the repository; do not add a new dependency unless the current toolchain cannot execute the test.

### Task 2: Normalize and persist Liquid Bath readings

**Files:**
- Modify: `src/models/CalibrationRecord.ts`
- Modify: `src/app/api/records/[id]/calculate/route.ts`
- Modify: `src/components/IsoCalibrationForm.tsx`

**Interfaces:**
- Consumes: `isoData.calPoints[]` from existing records.
- Produces: persisted `uucReadings`, `sensorReadings`, and `verticalReadings` with numeric API input and backward-compatible optional fields.

- [ ] **Step 1: Extend TypeScript and Mongoose calibration-point schemas**
  Add `uucReadings?: any[]` and `verticalReadings?: { center: any[]; top: any[]; bottom: any[] }` beside existing sensor readings.
- [ ] **Step 2: Normalize at the API boundary**
  Convert point, UUC, sensor, standard, and vertical cells using one finite-number helper; preserve valid zero values and convert malformed cells to `null`/ignored values.
- [ ] **Step 3: Add workbook-compatible form state**
  Initialize 15 UUC/sensor rows and 11 vertical rows for `TEM-002`; retain legacy state when editing records that lack the new arrays.
- [ ] **Step 4: Verify persistence manually through the existing record**
  Enter one row in each table, save, reload, and confirm values remain present before proceeding to calculation work.

### Task 3: Implement exact Liquid Bath statistics and uncertainty inputs

**Files:**
- Modify: `src/lib/isoUncertainty.ts`
- Modify: `src/lib/isoMethodSeeds.ts`
- Test: `scripts/test-iso-liquid-bath.ts`

**Interfaces:**
- Consumes: normalized `IsoCalcInput` from Task 2.
- Produces: `IsoCalcResult.calPointResults[]` with workbook-compatible statistics and uncertainty budget.

- [ ] **Step 1: Make failing fixture assertions cover each source**
  Assert source values for calibration, drift, interpolation residual, standard resolution, stem conduction, thermoelectric effect, stability, vertical uniformity, UUC resolution, and UUC repeatability.
- [ ] **Step 2: Implement source-specific Liquid Bath behavior**
  Use the UUC sample standard deviation, sensor half-range stability, same-time center-sensor uniformity, mean-based vertical uniformity, and global sensor variation.
- [ ] **Step 3: Correct degrees-of-freedom and rounding**
  Match the workbook's `n-1` behavior, coverage factor calculation, and report rounding for `uc`, `kp`, and `U`.
- [ ] **Step 4: Run the fixture test**
  Run `npm run test:iso-liquid-bath`; require all `44.5°C` and `95°C` assertions to pass.

### Task 4: Build reliable paste/import workflow

**Files:**
- Modify: `src/components/ExcelPasteInput.tsx`
- Modify: `src/components/IsoCalibrationForm.tsx`
- Test: `scripts/test-iso-liquid-bath.ts` (input-shape helper assertions if applicable)

**Interfaces:**
- Consumes: tab/newline clipboard matrices.
- Produces: validated updates for UUC, sensor, and vertical tables without dropping existing rows.

- [ ] **Step 1: Add table-specific import controls**
  Provide separate paste actions for UUC readings, 5-sensor readings, and vertical readings; show expected row/column counts.
- [ ] **Step 2: Validate matrix shape and numeric cells**
  Reject wrong column counts, report invalid cells, and accept fewer rows for draft entry while preserving blank cells.
- [ ] **Step 3: Verify paste-to-state behavior**
  Paste representative workbook matrices and confirm the rendered inputs show the first and last imported rows before save.

### Task 5: Align calculation page and PDF output

**Files:**
- Modify: `src/components/RecordCalculationPanel.tsx`
- Modify: `src/components/PdfViewer.tsx`
- Modify: `src/app/api/records/[id]/calculate/route.ts`

**Interfaces:**
- Consumes: one normalized `IsoCalcResult` from the calculation API.
- Produces: matching web and PDF tables for Liquid Bath distribution, performance, and uncertainty budget.

- [ ] **Step 1: Remove runtime shape assumptions**
  Render both legacy ISO results and the new `calPointResults` shape without accessing missing arrays.
- [ ] **Step 2: Add Liquid Bath performance sections**
  Display UUC indication, five sensor means, stability, uniformity, vertical uniformity, and overall variation per point.
- [ ] **Step 3: Add PDF sections from the shared result**
  Build the temperature distribution, water-bath performance, and uncertainty budget from API result data; do not recalculate in PDF code.
- [ ] **Step 4: Verify PDF data builder against fixtures**
  Assert the PDF builder receives the same point values and uncertainty values used by the calculation page.

### Task 6: Validate end-to-end and document operation

**Files:**
- Modify: `README.md` or a focused operator guide under `docs/`
- Test: `scripts/test-iso-liquid-bath.ts`

**Interfaces:**
- Consumes: completed form, API, engine, and PDF behavior from Tasks 2–5.
- Produces: verified Liquid Bath workflow and operator instructions.

- [ ] **Step 1: Run focused checks**
  Run `npm run test:iso-liquid-bath`, `npx tsc --noEmit`, and `git diff --check`.
- [ ] **Step 2: Run the production build**
  Run `npm run build`; if external font/network access blocks it, record that environment limitation separately from code failures.
- [ ] **Step 3: Exercise the browser workflow**
  Create/edit a `TEM-002` record, paste both workbook points, calculate, inspect the result page, and open the PDF preview.
- [ ] **Step 4: Update operator documentation**
  Explain the three input tables, paste formats, required fields, and expected result sections.
