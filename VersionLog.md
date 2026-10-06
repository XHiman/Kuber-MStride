# Version Log

## Kuber V2

**Version:** Kuber V2  
**Date:** 30 September 2026  
**Scope:** Search, profiles/scoping, dashboard, transfers, exports, mobile UI, admin controls, device access, and production-safety improvements.

---

## 1. Core Application Changes

### Global Search
- Implemented cross-entity global search.
- Search now covers:
  - Bills
  - Budgets
  - Transfers
  - Districts
  - Users
- Selecting a search result:
  - Opens the relevant application tab.
  - Applies the searched query as a filter.
- Search/navigation behavior is handled through `App.tsx` and the search service.

### User Profiles & Scoped Dashboard
- Added device-based user profiles.
- Added a dismissible prompt allowing users to provide their name.
- Added user/device records on the backend.
- Added program and district scope support.
- Added bill assignment fields.
- Added a personal/scoped dashboard through `DashboardTab.tsx`.
- Device IP address and browser/user-agent details are stored server-side.
- Device remapping is intentionally a developer/database operation rather than a public admin control.

### Vendor / DSU and Recipient Scope
- Bill **Vendor/DSU** selection now identifies either a:
  - Program
  - District
- Suggestions are populated from:
  - Existing profiles
  - District records
  - Previously saved transfers
- Users can still enter a new name when an existing option is unavailable.
- Bills persist the selected entity through the existing program/district fields.
- Transfer recipients now persist their selected program/district type.

### Navigation & Mobile UI
- Removed the frontend **Users** management tab.
- User and device records remain available through backend/admin functionality.
- The Dashboard remains visible in the main application.
- Added fixed bottom navigation for mobile devices.
- Added budget table card layouts for smaller screens.
- Updated responsive styling in `global.css`.

---

## 2. Transfer Improvements

- Recipient selection now provides existing people/recipients instead of requiring manual entry.
- Added an **Add another** option for creating a new recipient.
- Added recipient-specific frequently used:
  - Purposes
  - Object codes
- Transfer order date now defaults to the current day.
- Transfer exports now include:
  - Record timestamps
  - Utilization change history
- Utilization history is captured from the migration onward.
- Historical utilization changes that occurred before the migration cannot be reconstructed.

---

## 3. Export Improvements

- Export behavior was changed from directly downloading CSV data to a clipboard-first workflow.
- Export now:
  1. Generates the CSV-formatted snapshot.
  2. Copies that exact snapshot to the clipboard.
  3. Offers a download of the same copied snapshot.
- This functionality is implemented through `ExportActions.tsx`.

---

## 4. Admin Panel & Access Control

### Admin Panel
- Implemented the `/adminX` admin panel.
- Added server-side authentication.
- Added authenticated CRUD controls for:
  - Bills
  - Budgets
  - Budget heads
  - Object heads
  - Transfers
  - Districts
  - Users
  - Devices
- Admins can assign devices to users.
- Admins can grant or revoke device access.
- New devices remain blocked from tracker APIs until they are assigned and approved.

### Authentication
- Admin credentials are server-side only.
- `ADMIN_PASSWORD` must be supplied through the deployment environment.
- `ADMIN_SESSION_SECRET` must be supplied as a random server-only secret of at least 32 characters.
- Passwords must not be embedded in source code or frontend code.
- Any password previously shared during development should be rotated before production deployment.
- Signed-cookie authentication was tested, including rejection of:
  - Invalid credentials
  - Tampered session cookies

### Device Access
- Added device access control to the schema and migration.
- Newly registered devices are disabled by default until approved.
- Existing device access is preserved by the additive migration.
- Device remapping remains an internal developer/database operation rather than a public user-facing control.

---

## 5. Production Safety

- Removed production-dangerous npm scripts for:
  - Seed
  - Database reset
  - Budget import
- Seed/import code now:
  - Refuses production execution.
  - Requires explicit development opt-in.
- Deployment documentation was updated so production deployment does not instruct developers to seed the database.
- Prisma generation and compilation do not perform database writes.
- No seed, reset, import, or destructive database operation was run during validation.

### Deployment Requirement
The device access-control migration must be applied before deploying the corresponding backend changes.

Migration:

`backend/prisma/sqlite-migrations-legacy/20260930160000_device_access_control/migration.sql`

---

## 6. Database / Prisma Changes

### Main Kuber V2 Migration

Migration:

`backend/prisma/sqlite-migrations-legacy/20260930120000_users_search_transfer_history/migration.sql`

Schema:

`backend/prisma/schema.prisma`

Changes include the database structures required for:
- Users/device-based profiles
- Search
- Program/district scoping
- Transfer history
- Utilization history

The migration was applied to the local database.

### Transfer Scope Migration

Migration:

`backend/prisma/sqlite-migrations-legacy/20260930124500_transfer_program_district_scope/migration.sql`

Added persistence for the selected program/district scope on transfers.

### Device Access Migration

Migration:

`backend/prisma/sqlite-migrations-legacy/20260930160000_device_access_control/migration.sql`

Added device access-control support.

**Important:** During the admin/device-access implementation, this migration was initially pending. It must be applied in environments where the corresponding schema changes are not yet present.

### Local Database
- `backend/prisma/dev.db` is a local development database.
- It is a legacy SQLite development database and is no longer the active Prisma provider.
- PostgreSQL is the active provider; the previous SQLite migration history is archived under `backend/prisma/sqlite-migrations-legacy`.
- A production SQLite backup must be exported from the admin panel and restored into the new PostgreSQL database; changing providers does not copy data.
- It must not be committed/deployed as the production database.
- A modified local `dev.db` should be excluded from a production/code push unless there is an explicit reason to version the database file.

---

## 7. Validation

The following checks were performed across the Kuber V2 work:

- Prisma schema validation passed.
- Migration status checks passed where the relevant migration had been applied.
- Backend NestJS compilation passed.
- Frontend production build passed.
- API route smoke checks passed.
- Mobile layout checks passed.
- Admin login route rendered successfully in the browser.
- Signed admin session creation/verification passed focused checks.
- Invalid credential rejection passed.
- Session tampering rejection passed.
- Prisma was able to query the local SQLite database after the required client/database state was corrected.
- Existing local budget row count was verified as 84 during database troubleshooting.
- Unauthenticated admin-session requests correctly return `401`.
- `git diff --check` / whitespace validation passed.
- Local frontend preview processes used for validation were stopped afterward.

### Windows Build Note
The combined root build encountered a Windows Prisma engine-file locking error (`EPERM`) while the API/frontend tooling was running.

To isolate the issue:
- Backend compilation was validated separately.
- Frontend production build was validated separately.
- Prisma client generation was successfully performed using the no-engine workaround where required.

This was an environment/file-lock issue rather than a confirmed application compilation failure.

---

## 8. Important Developer Notes

### Do Not Commit
- Local SQLite database contents from `backend/prisma/dev.db`.
- Admin passwords.
- Admin session secrets.
- Any other deployment credentials.

### Required Production Environment Variables

```env
ADMIN_PASSWORD=<rotated-server-only-password>
ADMIN_SESSION_SECRET=<random-secret-at-least-32-characters>
```

### Migration Discipline
- Deploy migration files with the application.
- Apply pending migrations explicitly in the target environment.
- Do not use seed/reset/import commands as part of normal production deployment.
- Do not replace or reset production data when applying additive migrations.

---

## 9. Major Files / Areas Changed

### Database
- `backend/prisma/schema.prisma`
- `backend/prisma/sqlite-migrations-legacy/20260930120000_users_search_transfer_history/migration.sql`
- `backend/prisma/sqlite-migrations-legacy/20260930124500_transfer_program_district_scope/migration.sql`
- `backend/prisma/sqlite-migrations-legacy/20260930160000_device_access_control/migration.sql`
- `backend/prisma/migrations/20261006110000_postgresql_baseline/migration.sql`

### Backend
- `backend/src/app.module.ts`
- `backend/src/bills/bills.service.ts`
- `backend/src/search/search.service.ts`
- `backend/src/transfers/transfers.service.ts`
- Admin authentication/service/controller implementation
- Device/user access-control implementation
- Database/production safety scripts

### Frontend
- `frontend/src/App.tsx`
- `frontend/src/components/UsersTab.tsx`
- `frontend/src/components/DashboardTab.tsx`
- `frontend/src/components/ExportActions.tsx`
- `frontend/src/AdminApp.tsx`
- `frontend/src/global.css`

### Documentation / Configuration
- `README.md`
- `Version_Log.md`
- `package.json`
- `backend/package.json`
- `backend/prisma/seed.ts`
- `backend/prisma/import-budget.ts`

---

## 10. Change Summary

Kuber V2 introduces:

| Area | Change |
|---|---|
| Search | Cross-entity global search |
| Profiles | Device-based profiles and names |
| Scope | Program/district user and bill/transfer scoping |
| Dashboard | Personal/scoped dashboard |
| Transfers | Recipient selection, defaults, history and scope |
| Exports | Clipboard-first CSV export |
| Mobile | Fixed navigation and responsive budget cards |
| Admin | `/adminX` authenticated management panel |
| Devices | Assignment and access approval |
| Security | Server-side admin credentials and signed sessions |
| Production | Seed/reset/import protections |
| Database | User, search, transfer-history and device-access migrations |
| Validation | Backend, frontend, API, migration, auth and mobile checks |

---

## Kuber V2 Release Notes

Kuber V2 moves the application from a primarily shared tracker workflow toward a scoped, user-aware application with global search, personal dashboards, richer transfer workflows, mobile navigation, and authenticated administrative controls.

The release also establishes stricter production boundaries: destructive/development database operations are no longer part of normal production workflows, admin credentials are server-side only, and device access is explicitly controlled.
