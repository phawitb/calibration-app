# TEM-002 Liquid Bath Replacement Design

## Goal

Replace the `Water bath_PT2.67.xlsm` workflow for ISO method `TEM-002` with a web workflow that produces equivalent measurement results and a matching certificate/PDF report.

The first release is limited to Liquid Bath. Other ISO methods must continue to work without changing their existing data contracts or calculation behavior.

## Reference Data Model

Each calibration point stores:

- `point`: control/calibration temperature.
- `uucSetting`: bath display setting.
- `uucReadings`: repeated bath-display readings, independently from reference sensors.
- `sensorReadings`: repeated readings for five reference sensors, indexed as `[reading][sensor]`.
- `verticalReadings`: repeated `center`, `top`, and `bottom` readings for vertical uniformity.

The record also stores chamber dimensions, water level, environment maximum/minimum values, UUC resolution, and the selected standard instrument. All numeric values are normalized at the API boundary before calculation.

## Input Workflow

The Liquid Bath form presents one section per calibration point:

1. Set point and UUC setting.
2. UUC reading table.
3. Five-sensor reference reading table.
4. Vertical uniformity table.
5. Paste/import actions with row and column validation.

The default table sizes follow the reference workbook: 15 UUC/sensor readings and 11 vertical readings. The user may add calibration points and paste larger sensor datasets up to the configured method limit.

Validation requires a standard instrument, at least one calibration point, reference sensor readings, and UUC readings for `TEM-002`. Vertical readings are optional for drafts but required before requesting approval when the method's vertical uncertainty source is enabled.

## Calculation Contract

The calculation engine uses the following definitions:

- Sensor mean: arithmetic mean per sensor across valid repeated readings.
- UUC indication: arithmetic mean of `uucReadings`.
- Stability: maximum per-sensor half-range `(max - min) / 2`.
- Uniformity: maximum same-time absolute difference between the center sensor and every other sensor.
- Vertical uniformity: maximum absolute difference between the center mean and the top/bottom mean.
- Overall variation: global maximum minus global minimum across reference sensor readings.
- UUC repeatability: sample standard deviation of `uucReadings`.
- Combined uncertainty: root-sum-square of enabled uncertainty contributions.
- Expanded uncertainty: coverage factor multiplied by combined uncertainty, with report rounding matching the workbook.

The uncertainty source configuration for `TEM-002` remains data-driven. The implementation must ensure each source receives the correct input and unit, especially UUC repeatability, vertical uniformity, stability, and UUC resolution.

## Results and PDF

The calculation page exposes, per calibration point:

- control temperature and UUC indication;
- five sensor means;
- stability, uniformity, vertical uniformity, and overall variation;
- uncertainty budget rows with value, divisor, standard uncertainty, and degrees of freedom;
- `uc`, coverage factor, and reported expanded uncertainty.

The PDF uses the same calculation result object as the web page and includes:

- temperature distribution by reference position;
- water bath performance summary;
- uncertainty budget;
- environmental and chamber information.

No independent PDF-only formulas are allowed.

## Compatibility and Error Handling

- Existing ISO records without the new optional fields remain readable.
- Existing non-Liquid-Bath methods retain their current UI and engine paths.
- Empty or malformed cells are ignored for statistics and reported as validation errors when required data is missing.
- Calculation failures return a user-visible error instead of rendering a runtime exception.
- The page must support both the legacy ISO result shape and the new Liquid Bath result shape during migration.

## Verification Plan

Create deterministic regression fixtures from the workbook for `44.5°C` and `95°C`. Verify the following within an explicit tolerance:

- sensor means;
- stability;
- uniformity;
- vertical uniformity;
- overall variation;
- UUC mean and repeatability;
- each uncertainty component;
- combined uncertainty, coverage factor, and reported uncertainty.

Also verify that the same fixture produces equivalent values through the API calculation route and the PDF data builder, and that the UI can paste and persist all three reading groups.
