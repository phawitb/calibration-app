# PDF Certificate Labels and Dates Design

## Scope

Update only the generated calibration certificate PDF. Forms, record lists, reports, stored data, and API behavior remain unchanged.

## Layout and labels

- Change every PDF label `Manufacture` to `Manufacturer`.
- Change `Received N` to `Received No.`.
- Move `Hospital No.` from the customer information table into the device information table.
- Render `Hospital No.` as a full-width row immediately below the `Serial No. / Amed No.` row.
- Change `Meausre Unit` to `Measure Unit`.

## Date formatting

All dates displayed in the PDF use the English format `DD Mmm YYYY`, for example `01 Aug 2026`.

This applies to:

- Issued date
- Received date
- Cal. date on the certificate information page
- Cal.Date for the environmental reference standard
- Cal.Date for every reference standard in calibration-result sections

Date-time inputs must display only the date portion. Missing or invalid dates continue to display `-`.

## Implementation approach

Use one shared, deterministic PDF date formatter for every date field. Parse date-only strings without timezone shifting and normalize date-time values before rendering. Keep the existing PDF structure and styling except for the requested `Hospital No.` row relocation.

## Verification

Add regression coverage that verifies:

- Corrected labels appear and misspelled labels do not.
- `Hospital No.` is in the upper device table and no longer in the customer table.
- All relevant date values render as `DD Mmm YYYY` with no time component.
- Missing and invalid dates render as `-`.

Run the focused regression tests, the existing test suite, and the production build. Render a representative PDF when the local environment supports it and inspect the changed layout visually.
