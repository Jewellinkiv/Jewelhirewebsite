# Diamond Exchange Browser Smoke

Created: 2026-07-22T21:39:41Z
Result: PASS
Values printed: false

This report records non-secret browser-observed evidence from the approved
Diamond Exchange JewelLink SSO smoke slice. It does not record cookies, full
email addresses, bearer tokens, passwords, database URLs, resume contents,
screenshots, or customer data.

## Scope

| Field | Value |
| --- | --- |
| JewelHire base | `https://app.jewelhire.com` |
| JewelLink launch source | `https://ai.jewellink.com/crm/homepage` |
| Pilot store | `store-jl-58deb73ef9454405c4fe` |
| Controlled application | `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` |
| Browser session | Chrome, launched from JewelLink `Open JewelHire` |

## Passing Checks

- PASS JewelLink Director session was present on the Diamond Exchange CRM home
  page and exposed the `Open JewelHire` launch link.
- PASS JewelHire opened from the JewelLink launch path and rendered the
  Diamond Exchange dashboard with all-location scope.
- PASS Store-owner surfaces rendered for the session, including Settings,
  billing included-with-JewelLink state, integration health, and user-admin
  controls.
- PASS The controlled application detail page opened for the approved pilot
  application and showed a private resume attachment without downloading or
  storing resume contents.
- PASS Hire preview rendered for the controlled application, including the
  expected role, Downtown Flagship location, pending JewelCert state, and the
  `Confirm hire -> JewelLink` action.
- PASS Hire confirmation completed through the UI and rendered the
  `Added to JewelLink` success state.
- PASS A read-only post-confirm target audit observed the same controlled
  application in `hired` stage with a JewelLink hire sync status of `synced`.
- PASS Public unauthenticated access to the controlled resume endpoint returned
  `401` with `unauthenticated`.
- PASS Settings rendered the team-onboarding paused state with user invites,
  role changes, and ownership transfers disabled in the UI.

## Not Closed By This Artifact

The following smoke rows still need separate concrete PASS artifacts:

- Manager SSO.
- Student SSO.
- Platform-admin SSO.
- Repeat confirm API idempotency.
- Revoked/cancelled hire access.
- JewelCert invite from JewelLink.
- JewelCert completion.
- JewelCert result sync to JewelLink.
- JewelCert retry path.
- Team-invite API fail-closed POST probes.
- Resume privacy same-store authenticated headers-only probe.

## Notes

- The post-confirm `qa:pilot-smoke-targets` run is intentionally not used as a
  PASS artifact because the overall target audit now fails after the controlled
  hire target has been consumed. Its useful corroborating signal is that the
  controlled application is hired and synced.
- No JewelHire session cookie was copied from Chrome storage. Cookie-based
  runners remain blocked until an ignored local cookie file is provided through
  an approved operator-safe path or an equivalent browser-safe authenticated
  runner is implemented.
