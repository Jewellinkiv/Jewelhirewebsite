# Production Pilot Smoke Targets Request

Created: 2026-07-21T07:30:52.842Z
Values printed: false

This packet is an evidence aid only. It does not authenticate, create applications, hire anyone, download resumes, write to JewelLink, or write to the JewelHire production database.

Status: needed

## Missing Evidence

| Check | Evidence needed |
| --- | --- |
| controlled applicant has a pilot application | Existing controlled applicant application in pilot company/store |
| controlled hire application target is available | Pilot application for the controlled applicant with no existing hire sync and non-terminal stage |
| controlled resume privacy application target is available | Pilot application for the controlled applicant with a private resume attachment |

## Verification

Run `npm run qa:pilot-smoke-targets` and require the report to pass before copying the non-secret application IDs into the pilot smoke plan.

Do not place full emails, applicant names, passwords, database URLs, bearer tokens, cookies, resume content, customer data, or secret values in committed evidence.
