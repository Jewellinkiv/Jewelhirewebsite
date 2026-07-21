# JewelLink Migration Drift Owner Acceptance Request

Created: 2026-07-21T03:02:56.057Z
Values printed: false

This packet is an approval aid only. It does not repair the ledger, edit JewelLink, run migrations, create backups, restore data, or write to either production database.

Status: needed
Scope: historical non-integration JewelLink Prisma checksum drift
Unrecovered migration count: 3

## Required Acceptance Fields

- Named database owner
- Owner role or approval channel
- UTC acceptance timestamp
- Review artifact or ticket reference
- Acceptance statement
- All three acknowledgements set to true in the JSON file

## Unrecovered Rows

| Migration | Applied checksum | Reviewed checksum | Applied window |
| --- | --- | --- | --- |
| `20260520152458_add_hidden_lesson_ids` | `2758166eab11` | `f6a5195d9e4e` | 2026-05-20 20:30:14.778153+00 to 2026-05-20 20:30:14.989886+00 |
| `20260604125555_course_package_tag` | `fb99db7a7342` | `e895f8bf0962` | 2026-06-04 17:56:05.123341+00 to 2026-06-04 17:56:05.346266+00 |
| `20260604142331_feature_announcements` | `b0d1e70fd19a` | `d211b09b6a48` | 2026-06-04 19:23:40.41933+00 to 2026-06-04 19:23:40.910931+00 |

## Verification

Run the drift audit again with `--database-owner-acceptance-file=<path>` and require the owner-acceptance check to pass.

Do not place database URLs, bearer tokens, passwords, cookies, customer data, secret values, or full production data extracts in the acceptance file.
