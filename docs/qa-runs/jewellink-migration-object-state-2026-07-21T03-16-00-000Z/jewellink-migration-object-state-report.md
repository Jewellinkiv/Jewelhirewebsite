# JewelLink Migration Object State Audit

Created: 2026-07-21T03:15:41.083Z
Result: PASS
Values printed: false

## Scope

- Read-only schema/object-state audit for the 3 still-unrecovered historical JewelLink Prisma drift rows.
- No customer rows are read.
- No database writes, migration repairs, JewelLink edits, or deploys are performed.

## Summary

- Tables checked: company_course_visibility, course_package, feature_announcements, feature_announcement_reads
- Checks passing: 20/20

## Checks

| Result | Check | Observed |
| --- | --- | --- |
| PASS | JewelLink database credential is available for read-only object-state audit |  |
| PASS | company_course_visibility.hiddenLessonIds matches reviewed migration object state | text; nullable=true; default=none |
| PASS | course_package.tag matches reviewed migration object state | text; nullable=false; default=present |
| PASS | feature_announcements.id matches reviewed migration object state | text; nullable=false; default=none |
| PASS | feature_announcements.createdAt matches reviewed migration object state | timestamp without time zone; nullable=false; default=present |
| PASS | feature_announcements.updatedAt matches reviewed migration object state | timestamp without time zone; nullable=false; default=none |
| PASS | feature_announcements.title matches reviewed migration object state | text; nullable=false; default=none |
| PASS | feature_announcements.body matches reviewed migration object state | text; nullable=false; default=none |
| PASS | feature_announcements.isActive matches reviewed migration object state | boolean; nullable=false; default=present |
| PASS | feature_announcement_reads.id matches reviewed migration object state | text; nullable=false; default=none |
| PASS | feature_announcement_reads.readAt matches reviewed migration object state | timestamp without time zone; nullable=false; default=present |
| PASS | feature_announcement_reads.userId matches reviewed migration object state | text; nullable=false; default=none |
| PASS | feature_announcement_reads.announcementId matches reviewed migration object state | text; nullable=false; default=none |
| PASS | feature_announcements_isActive_createdAt_idx index matches reviewed migration object state | nonunique (isActive, createdAt) |
| PASS | feature_announcement_reads_userId_announcementId_key index matches reviewed migration object state | unique (userId, announcementId) |
| PASS | feature_announcement_reads_userId_idx index matches reviewed migration object state | nonunique (userId) |
| PASS | feature_announcements_pkey constraint matches reviewed migration object state | p; columns=(id) |
| PASS | feature_announcement_reads_pkey constraint matches reviewed migration object state | p; columns=(id) |
| PASS | feature_announcement_reads_userId_fkey constraint matches reviewed migration object state | f; columns=(userId); references=user(id) |
| PASS | feature_announcement_reads_announcementId_fkey constraint matches reviewed migration object state | f; columns=(announcementId); references=feature_announcements(id) |

No database URLs, bearer tokens, passwords, cookies, customer rows, customer data, or secret values are written to this report.
