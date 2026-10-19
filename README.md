<div align="center">

# MahaSTRIDE · MITRA

### Bill, Budget & Fund Transfer Tracker

**A focused workspace for bill clearance, fiscal-year budgets and agency fund transfers.**

<br />

**Developer & project father:** XHiman &nbsp; · &nbsp; **Vision & brains:** Sandesh Joshi

<br />

![React](https://img.shields.io/badge/React-18-149ECA?style=flat-square&logo=react&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-EA2845?style=flat-square&logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)

</div>

---

## At a glance

MahaSTRIDE Tracker brings day-to-day financial tracking into one interface. Follow a bill from invoice to treasury clearance, compare provisions with expenditure across fiscal years, and review fund transfers by recipient—including utilization and remaining balance.

The interface follows the device's **light or dark appearance** by default (System / Light / Dark), and switches between **English and Marathi**. The language changes interface text, tooltips and known error messages; records and user-entered content stay as entered. The interface is audited against **WCAG 2.1 AA** (axe-core, both themes, 360 px and 200 % zoom).

## Workspaces

| Workspace | What it helps you do |
| --- | --- |
| **Bills pipeline** | Six clearance stages as clickable cards that filter the register and deep-link with `?stage=tfc`. KPIs carry "as of" times. A sorted bar chart by vendor or DSU has a table view. **Needs action** lists held bills and bills with missing data, each with owner, next action, Assign and Mark resolved. **Aging** buckets (0–30 / 31–90 / 91–180 / 180+ / no date) have a configurable Overdue threshold. The **bill register** is sorted oldest first, has saved views, 25-row pages, a timeline drawer showing who, when and why, and a filtered **Export CSV**. |
| **Budget by FY** | Review provisions, expenditure and balance by object code across FY 2024-25–2029-30, or use the read-only **FY Total** view. The desktop table keeps its header and first two columns fixed and lets each four-column funding group collapse together. Ledger cells always show exact rupees because they are edited in place. |
| **Fund transfers** | Keep Program releases in Fund Transfers and classify District releases as Incentive Funds or Consultants Grant. Each utilization entry is dated and stored under its transfer; district categories default to A233 / object code 10. |
| **Dashboard** | **Your assigned work & scope**: sign in to see your name, role, scope, open items, oldest open item, bills assigned to you, and your open items oldest first. |

The global search bar searches bills, budgets, transfers, districts and people from any tab. The bill register downloads a CSV of the current filtered view, with the filters written in the file header. Other tables copy CSV to the clipboard first, then offer a download.

Money uses one format everywhere: **₹24.07 Cr**, **₹35.4 L**, or the full figure below ₹1 L (**₹53,880**). The exact rupee amount is in the tooltip, and the **Exact amounts** switch shows it inline. Dates read **19 Oct 2026**.

## Status glossary

| Stage | Meaning |
| --- | --- |
| 1. **Invoice raised** | The vendor or DSU invoice has been received and logged. Waiting for the PMC to check it. |
| 2. **PMC check** | The PMC is verifying the invoice against deliverables and reports. |
| 3. **TFC approval** | Waiting for the TFC/TEC committee to approve payment. |
| 4. **File approval pending** | Committee-approved. The payment file is put up for sign-off before it goes to the treasury. |
| 5. **Sent to treasury** | Submitted to the treasury and awaiting clearance. |
| 6. **Cleared by treasury** | Passed by the treasury and payment released. Counted as cleared. |
| ⚠ **On hold / exception** | Paused at its current stage because of an objection or missing information. A hold remark explains why; the bill keeps its stage. |

Stage values on the cards are **currently at that stage**, not cumulative. Instead of a vague "Please Check", bills show a specific **action reason** derived from the data: *Awaiting handover data*, *Missing invoice no.*, *Missing invoice date*, *Missing e-file no.* (from File approval pending onward), *Under query*, *Needs approval*, or *Reason not recorded*. The same glossary is in the app under "What do these mean?".

## Data format

- **Bills** (`bills`): vendor, invoice, e-file number, invoice date, amount raised, sanctioned amount, stage (`bucket`), category (`cleared` / `in_progress` / `on_hold`), hold remark, free-text status, program/district, assignee, budget code and object head.
  - The **effective amount** is the sanctioned amount once a bill is Cleared by treasury, otherwise the amount raised; every total uses it.
  - **Days open** = today − invoice date.
- **Stage history** (`bill_stage_history`): one row per event (`created`, `tracked` stage move, `hold`, `release`, import snapshots), with time, author (`changedByName`) and optional note.
- **Vendor names** are normalised for display and grouping in `frontend/src/lib/vendors.ts`, for example "Nagpur - E & Y" and "DSU Nagpur- E & Y" become **DSU Nagpur – E&Y**. Stored values are never changed; the raw spelling appears in tooltips and the CSV.
- **Privacy**: 9–18 digit runs in free text (account or phone numbers) are masked as `XXXX XXXX 1234` on screen and in exports.

## Roles

Users have a placeholder `role` (**TODO**: proper role management):

- `finance` (default): the dashboard covers every bill.
- `dsu`: the dashboard covers bills for the DSU district(s) in the user's `districts` scope (matched through the vendor map or the bill's district), plus bills assigned to them.

Set the role in the admin panel's user JSON (`"role": "dsu"`). Roles shape the dashboard only and are **not access control**: bills remain publicly readable, and signing in is still what allows editing.

## Research hooks (optional)

An anonymised usage log for UX research is **off by default**. It runs only when the frontend is built with `VITE_RESEARCH_LOG=true` **and** the API runs with `RESEARCH_LOG_ENABLED=true`. It records page views, filters used (names only), time to find an overdue bill and error kinds, under a random per-tab id. It never records user ids, names, search text or record values, and the server whitelists every field. The **Feedback** button on every page stores one line with the page name only. Admins export both from `GET /adminX/api/research`.

Bills, budgets, transfers and search are available without signing in. Only the personal dashboard requires a user account. Administrators create each user's username and password and maintain their program/district scopes in the admin panel. Passwords are stored as scrypt hashes; dashboard sessions expire after eight hours and are kept in the current browser tab only.

## Built with

- **Frontend:** React 18, TypeScript and Vite
- **Backend:** NestJS 10 and TypeScript
- **Data access:** Prisma 5
- **Database:** PostgreSQL through Prisma

## Get started

### Requirements

- Node.js and npm

### Install and run

From the repository root:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Vite frontend proxies API requests to the NestJS API on port `3001`. The database is not seeded automatically.

### Switch the local frontend between local and live data

By default, `npm run dev` runs the local backend and frontend; the frontend proxies API requests to `http://localhost:3001`. To use the deployed VM API instead, stop the default dev process and run:

```bash
npm run dev:production-api
```

This serves the frontend locally at `http://localhost:3000`, while Vite proxies its API requests through `https://data.mahamitra.org/bill-api`. The browser still talks only to localhost, so no production CORS change is needed. To switch back, stop that process and run `npm run dev` again.

**Production mode writes to the live database.** Creating, editing, importing, or deleting records from this local UI changes production data. Use the admin database backup before risky operations. The proxy target is set in the tracked `frontend/.env.production-api` file.

The local PostgreSQL Windows service is running on this development PC, but local backend startup also needs a valid `DATABASE_URL` and a database role/password configured in the ignored `backend/.env` file. Copy `backend/.env.example` and fill in local credentials; never commit that file. The `DATABASE_URL` already in an environment file on another machine is not reused automatically.

### Tests and audits

```bash
npm test
```

This runs the Vitest unit and component tests for both workspaces. They lock the dashboard totals (stage values sum to the total, cleared % and per-stage values) and cover aging buckets, vendor normalisation, money and date formats, reason codes, roles and scope, the audit trail, account masking, research input validation, the register, the drawer, toasts and Undo. Tests that need the real-data snapshot (`backend/test/fixtures/*.local.json`, gitignored) are skipped when it is absent.

With `npm run dev` running (the browser checks need Chromium once: `npx playwright install chromium`):

```bash
npm run test:a11y
```

This runs axe-core (WCAG 2.1 A/AA) on every tab, the glossary and the bill drawer in light and dark, and checks for horizontal scroll at 360 px and 200 % zoom. It exits non-zero on any failure.

```bash
npm run test:i18n
```

This walks every tab and overlay in Marathi and fails on any interface string without a translation.

```bash
npm run screenshots --workspace=frontend -- after
```

This captures light/dark × desktop/mobile × four tabs into `SCREENSHOTS/after/`.

All three scripts only read and navigate; they never create or edit records.

To create a production bundle:

```bash
npm run build
```

Production builds use `/bill/` as the default asset base to match the VM deployment. Set `VITE_BASE_PATH` when building for a different mount path.

## Database & deployment

The active provider is PostgreSQL. For local development, set `DATABASE_URL` to a PostgreSQL connection string. The previous SQLite migrations are archived under `backend/prisma/sqlite-migrations-legacy` and must not be applied to PostgreSQL.

### VM deployment (`https://data.mahamitra.org/bill/`)

The repository is located at `/var/www/bills`; it does not replace the existing `/var/www/Nada` site files. Apache serves the built frontend at `https://data.mahamitra.org/bill/` from `/var/www/bills/frontend/dist`, and proxies `/bill-api/` to the API listening only on `127.0.0.1:3001`. PostgreSQL uses its own local port, normally `127.0.0.1:5432`. Neither backend port needs to be publicly exposed.

On an Ubuntu/Debian VM, check existing database listeners before installing PostgreSQL:

```bash
sudo ss -ltnp | grep -E ':(3306|5432)\b' || true
```

MariaDB normally uses port `3306`; PostgreSQL normally uses port `5432`, so they can run at the same time. Do not stop or reconfigure the existing MariaDB service. If `5432` is already occupied, configure PostgreSQL to use another free local port (for example `5433`) and use that same port in `DATABASE_URL`.

Install PostgreSQL, Apache proxy modules, and Node.js/npm:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib apache2
sudo a2enmod proxy proxy_http
sudo -u postgres createuser --pwprompt mitra_app
sudo -u postgres createdb --owner=mitra_app mahastride
```

Install a supported Node.js LTS release (Node.js 20 or newer) if it is not already installed. Put or clone this repository at `/var/www/bills`. Install dependencies and build the backend/frontend:

```bash
cd /var/www/bills
npm install
VITE_BASE_PATH=/bill/ VITE_API_URL=/bill-api npm run build
sudo chown -R www-data:www-data /var/www/bills
```

Create `/etc/mahastride/mahastride.env` from `backend/.env.example`, then set the PostgreSQL URL and new secrets. With the default PostgreSQL port, the local database URL is:

```env
DATABASE_URL=postgresql://mitra_app:URL_ENCODED_PASSWORD@127.0.0.1:5432/mahastride?schema=public
HOST=127.0.0.1
PORT=3001
FRONTEND_ORIGIN=https://data.mahamitra.org
NODE_ENV=production
ADMIN_PASSWORD=<new-long-random-password>
ADMIN_SESSION_SECRET=<random-secret-at-least-32-characters>
```

If you configured PostgreSQL for port `5433` or another port, change `5432` in `DATABASE_URL` to match. URL-encode special characters in the PostgreSQL username/password. Keep this file outside the repository, owned by `root:www-data` with mode `0640`; never commit database credentials.

Install `deploy/systemd/mahastride.service` as `/etc/systemd/system/mahastride.service`. Install `deploy/apache/bill.conf` under `/etc/apache2/conf-available/mahastride-bill.conf`, then enable it with `sudo a2enconf mahastride-bill`. The Apache snippet is intended to be included by the existing Apache site configuration and does not replace its `DocumentRoot` or HTTPS certificate. Ensure the existing HTTPS virtual host for `data.mahamitra.org` includes Apache conf-available files. Validate/reload Apache, then enable the API:

```bash
sudo apachectl configtest
sudo systemctl reload apache2
sudo systemctl daemon-reload
sudo systemctl enable --now mahastride
```

The production start script runs `prisma migrate deploy` before starting the API. This migration history creates the PostgreSQL schema; it does not copy data from the previous SQLite database or MariaDB. Before retiring the old service, download its private JSON backup from the admin portal. After the new VM API is running, restore the backup through the admin portal into PostgreSQL and verify bills, budgets, transfers, and user login. Restore replaces all rows in the target database, so only do this on the new database. PostgreSQL data is stored on the VM disk; configure VM/disk backups as well.

For a VM firewall, allow public HTTP/HTTPS (ports 80/443) and SSH as needed; do not expose PostgreSQL port 5432 or API port 3001 publicly. Apache proxies requests on the same origin, so browser CORS is not required for this `/bill/` deployment.

Legacy seed/import files are disabled in production and their package scripts have been removed. The development seed is destructive and requires explicit `ALLOW_DESTRUCTIVE_DEV_SEED=true`; a development budget import requires `ALLOW_BUDGET_IMPORT=true`. Do not set these variables in production.

### Admin panel

Open `/adminX` to sign in and manage bills, budgets, budget heads, object heads, transfers, districts and user accounts. The panel uses an expiring, tab-scoped signed session so authentication works when the static frontend and API are hosted on separate origins. For local development, copy `backend/.env.example` to `backend/.env` and replace the placeholder values with a new password and a random `ADMIN_SESSION_SECRET` of at least 32 characters. The backend loads this file on startup; it is git-ignored. In production, configure the admin values as server-only deployment secrets. Never place credentials in frontend variables or source control. Rotate any password previously shared in chat before deployment. Set each dashboard user's unique username and an initial password of at least 10 characters in their admin user record; set a new password on that record to reset it.

The admin panel can import rows from `.xlsx` or `.csv` files for bills, budgets, budget heads, object heads, transfers, districts and users. Bill imports accept the optional `efileNumber` column. Budget imports update an existing row when `fiscalYear` and `code` match, adding only rows without a match; blank cells leave existing values unchanged. Other entity imports remain additive and do not update or deduplicate existing records. Download a CSV template to get the exact column names. Each table also has a **Download CSV** action in the records panel for its full set of current rows. User imports require a unique username and password. For bills, any populated `budgetCode`, `objectHead`, `transferId` or `assignedUserId` must match an existing record; import the referenced tables first or leave optional reference cells blank. Rows are checked independently, and the admin reports specific row errors with a downloadable CSV report. The **Download whole database** action exports every table, including bill stage history, transfer history, and user password hashes, to a versioned JSON backup. Keep this file private. **Replace database from backup** restores that file atomically and replaces all current records; take a fresh backup first. Restore works against the current schema and ignores fields no longer recognized by the running version.

## Repository map

```text
backend/
  prisma/                 Schema, migrations, seeds and budget importer
  src/bills/              Bill register and clearance dashboard
  src/budget/             Fiscal-year budget and totals
  src/transfers/          Transfer records and budget accounting
  src/districts/          District Incentive Fund records
  src/users/               User sign-in and personal dashboard scopes
  src/search/              Cross-entity global search
  src/research/            Opt-in anonymised usage log and feedback
  src/common/             Shared fiscal-year and bill utilities
frontend/
  src/App.tsx             App shell, workspace navigation and display controls
  src/features/           Bills (register, drawer, aging, needs action, vendor chart), budget, transfers, dashboard
  src/components/         Shared UI: Money, glossary, toasts, dialogs, skeletons, feedback
  src/global.css          Design system, themes and responsive layout
  src/lib/                API client, formats, status/reason codes, aging, vendors, scope, privacy, research
  e2e/                    Accessibility, Marathi-coverage and screenshot scripts (Playwright)
SCREENSHOTS/              Before/after captures (light/dark, desktop/mobile)
```

## Data and accounting notes

- Supported fiscal years are **FY 2024-25 through FY 2029-30**. **FY Total** aggregates these years and is read-only.
- The fiscal-year importer does not overwrite expenditure.
- A transferred amount affects its selected fiscal-year budget head. Edits or removal reverse the corresponding impact.
- A bill's sanctioned amount is its effective cleared amount when present at Treasury Clearance; otherwise the raised amount is used. A hold remark is required when a bill is put on hold.
- Bill stage history records each tracked transition, hold and release with its author and optional note ("Reason for change"); Undo writes a second entry rather than deleting the first. Existing bills receive a one-time snapshot of their current stage when the history migration is applied; earlier transitions cannot be reconstructed.
- A cleared bill linked to a transfer updates that transfer's utilization; it is not counted against budget a second time.
- Each manual utilization and linked cleared-bill utilization is stored as a child record with its own date. Existing aggregate utilization is migrated with a note that its original entry date is unavailable.
- Bill clearance year is derived from the clearance date in its status entry where available.
- Standalone district release records remain separate from transfer accounting.

## API overview

The frontend communicates with the NestJS API. Common routes include:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/bills` | List or create bills |
| `GET` | `/bills/dashboard` | Bill pipeline summary |
| `PUT`, `DELETE` | `/bills/:id` | Update or remove a bill (optional `changeNote` goes to history) |
| `GET` | `/budget?fiscalYear=…` | Read a fiscal-year budget |
| `PUT` | `/budget/:fiscalYear/:code` | Update a budget row |
| `GET`, `POST` | `/transfers` | Transfer summary or create a transfer |
| `GET` | `/transfers/records` | List transfer records |
| `PUT`, `DELETE` | `/transfers/:id` | Update or remove a transfer |
| `POST` | `/transfers/:id/utilizations` | Add a dated utilization entry |
| `PUT`, `DELETE` | `/transfers/:id/utilizations/:utilizationId` | Update or remove a manual utilization entry |
| `GET` | `/search?q=…` | Search bills, budgets, transfers, districts and users |
| `GET` | `/users` | List named users |
| `POST` | `/users/login` | Sign in to the personal dashboard |
| `GET` | `/users/session` | Read the signed-in user's profile |
| `GET` | `/users/dashboard` | Read the signed-in user's scoped bills and district records |
| `GET`, `POST` | `/districts` | District summary or create a district record |
| `GET` | `/districts/records` | List district records |
| `PUT` | `/districts/:id` | Update a district record |
| `POST` | `/research/events` | Anonymised usage events (stored only when `RESEARCH_LOG_ENABLED=true`) |
| `POST` | `/research/feedback` | One-line feedback with the page name |
| `GET` | `/adminX/api/research` | Export usage events and feedback (admin) |

## Known limitations

- **Roles are a placeholder.** They shape the dashboard but do not restrict the API; all bills stay publicly readable.
- **Who / why history starts with the Step 8 migration.** Earlier entries show "not recorded". Imported stage history contains no real moves yet, so "moved this month" shows none until bills are moved in the app.
- **Action reasons are derived, not stored.** They are inferred from missing fields and hold remarks; a bill with nothing missing but an unclear status shows *Reason not recorded*.
- **Marathi wording is machine-drafted** and marked TODO for review by a native speaker. The coverage check only sees text passed through `t()`.
- **Automated accessibility checks** (axe, reflow) do not replace a manual screen-reader pass (NVDA, TalkBack) or usability testing with finance and DSU staff.
- Budget ledger cells always show exact rupees (they are edited in place); everywhere else uses the Cr / L format.

## Credits

**Built and developed by XHiman** — developer and project father.

**Product vision and the brains behind the project: Sandesh Joshi.**

---

<div align="center">

Made with care for clearer financial tracking.

</div>
