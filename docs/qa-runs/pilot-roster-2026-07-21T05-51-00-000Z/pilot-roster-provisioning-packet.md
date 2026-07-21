# Production Pilot Roster Provisioning Packet

Created: 2026-07-21T05:50:35.277Z
Values printed: false

This packet is an approval and execution aid only. It does not create users, change roles, update allowlists, send email, start SSO, or write to either production database.

Pilot company ID: comp_1
Expected pilot location IDs: loc_1, loc_2, loc_3, loc_4, loc_5, loc_6
Actions required: 2

## Create controlled JewelLink CONSULTANT denial persona

- Action ID: consultant-denial
- Status: needed
- System of record: JewelLink production
- Production mutation required: yes
- Approval required: yes
- Purpose: Authenticated JewelLink SSO smoke must prove CONSULTANT users fail closed in JewelHire.

Constraints:

- Company must be the pilot company comp_1.
- Role must be CONSULTANT.
- User must be active and MFA-backed for the smoke window.
- Primary location should be one of: loc_1, loc_2, loc_3, loc_4, loc_5, loc_6.
- User must not be included in the JewelHire platform-admin allowlist.
- Use a controlled test mailbox only; do not record the full address in Git or qa-runs.

Verification: Rerun qa:pilot-roster and require PASS Consultant denial candidate exists.

## Create controlled active user in a paused JewelLink company

- Action ID: paused-company-denial
- Status: needed
- System of record: JewelLink production
- Production mutation required: yes
- Approval required: yes
- Purpose: Authenticated JewelLink SSO smoke must prove paused-company access fails closed in JewelHire.

Constraints:

- Company must be paused in JewelLink.
- User must be active and MFA-backed for the smoke window.
- User must not belong to the pilot company.
- User must not be included in the JewelHire platform-admin allowlist.
- Use a controlled test mailbox only; do not record the full address in Git or qa-runs.

Verification: Rerun qa:pilot-roster and require PASS paused-company denial candidate exists.

## Verification

Run: npm run qa:pilot-roster

Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, or secret values in this packet.
