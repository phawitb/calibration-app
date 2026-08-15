# Expandable Calibration Record Documents

## Goal

Allow users on the calibration history page (`/records`) to click a record row and expand an inline document panel. The panel provides the same document access available under Medical Device Information > Documents.

## Interaction

- Clicking anywhere on a record row expands it.
- Clicking the expanded row again collapses it.
- Only one row is expanded at a time. Clicking another row collapses the current row and expands the selected row.
- The row supports keyboard activation with Enter and Space.
- Existing action controls (View/Edit, PDF, and Delete) keep their current behavior and do not expand or collapse the row.
- A directional chevron communicates the collapsed or expanded state.

## Expanded Content

The expanded panel appears immediately below its record row and shows:

- the calibrator name;
- the approver name;
- a Calibration Certificate button;
- a Calibrator Certificate button when `calibratedById` is available; and
- an Approver Certificate button when `approvedById` is available.

Document buttons open their document in a new browser tab. The calibration certificate opens `/records/{recordId}/pdf`. Personnel certificate buttons request the user's certificate list from `/api/users/{userId}/certificates` and open the first returned certificate, matching the existing Medical Device Information behavior. If the request fails or no certificate exists, the page displays a clear toast notification.

## Data Flow

The records list API will include `calibratedById` and `approvedById` in its existing projection. The records page will add these optional fields to its row type and use them directly when rendering document actions. No additional request is needed when a row expands.

## Component Boundaries

The change remains local to the records page because the requested interaction differs from the nested history table on the medical-device page. Small pure helpers may be extracted for expansion state or event handling when that makes behavior directly testable, but the existing medical-device UI will not be refactored in this change.

## Accessibility and Responsive Behavior

- The primary row exposes button-like keyboard behavior and an expanded state.
- Expanded content uses a full-width table row and wraps document buttons on narrow screens.
- Interactive controls stop event propagation so their native action is preserved.
- Focus styles remain visible for keyboard users.

## Error Handling

- A missing personnel ID hides the corresponding personnel-certificate button.
- An empty certificate list reports that the selected person has no certificate.
- A failed certificate-list request reports that the certificate could not be loaded.
- Opening the calibration certificate remains available regardless of personnel certificate state.

## Verification

- Automated tests cover row expansion, switching between rows, action-control event isolation, and personnel-certificate result handling.
- Type checking/build verifies the records API projection and page types.
- Manual browser verification confirms mouse and keyboard interaction, correct button visibility, new-tab document opening, and responsive layout on `/records`.

## Out of Scope

- Uploading, deleting, or selecting among multiple personnel certificates.
- Changing the PDF certificate viewer.
- Refactoring the Medical Device Information page.
- Changing permissions for viewing or editing calibration records.
