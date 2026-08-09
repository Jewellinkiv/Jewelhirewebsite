# Sissy's Log Cabin careers launch log

## Launch scope

- Public careers page: `https://app.jewelhire.com/careers/sissy-s-log-cabin-4c3b2d64`
- Roles prepared as drafts: Luxury Jewelry Sales Associate, Office Coordinator, and Store Sales Manager.
- Each role will be available at every Sissy's Log Cabin store. An applicant can select any participating store, one preferred store, or several preferred stores.

## Release work in this change

- Jobs can target all locations or a chosen non-empty set of locations.
- Existing job editors show the same all/selected location controls.
- Public applications persist the candidate's per-application store preference; it appears in the job's applicant list for the hiring team.
- The database migration adds durable targeting and preference fields while retaining the legacy display-location field for compatibility.

## Required cutover steps

1. Deploy this release and its database migration through the guarded production workflow.
2. Change the three Sissy's draft roles to **All store locations**, then activate them.
3. Publish the Sissy's public careers page.
4. Replace the existing Shopify Careers destination with the public JewelHire URL above.
5. Run and record controlled browser smoke applications for:
   - any participating store;
   - one selected store; and
   - multiple selected stores.
6. Confirm each application appears in the correct Sissy's job pipeline with the expected store preference.

## Follow-ups after launch

- Verify candidate and manager notification delivery using Sissy's real sender and recipient configuration. The connected Google/Microsoft calendar-email provider controls were unavailable during initial workspace setup, so appointment automation must be separately confirmed.
- Decide how hiring managers should use a multi-store preference when routing, interviewing, and hiring a candidate; the preference is recorded and displayed, but it does not automatically assign an owner or a final hire location.
- Add a monthly audit for roles marked “All locations” so closed or newly opened stores are intentionally included or excluded.
- Capture the final Shopify URL change, deployment revision, and smoke-test evidence in this log once the production actions are complete.
