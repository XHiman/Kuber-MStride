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

The interface supports **light and dark appearance** and **English and Marathi UI labels**. Switching the display language changes static interface text; records and user-entered content remain as entered.

## Workspaces

| Workspace | What it helps you do |
| --- | --- |
| **Bills pipeline** | Track six clearance checkpoints, search and filter the register, select or enter a Vendor/DSU as a Program or District, assign bills to a person, review aging and exceptions, and copy or download the register. |
| **Budget by FY** | Review provisions, expenditure and balance by object code across FY 2024-25–2029-30, or use the read-only **FY Total** view. Search globally and use the compact mobile budget cards. |
| **Fund transfers** | Select or enter recipients as Programs or Districts, reuse their most frequent purpose/object code, and audit transfer changes and utilization history. |
| **Dashboard** | Sign in with an administrator-provisioned account to see personal bill and district work. |

The global search bar searches bills, budgets, transfers, districts and people from any tab. Exports first copy the full CSV-formatted table to the clipboard; a CSV download action appears after a successful copy.

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

Open [http://localhost:5173](http://localhost:5173). The Vite frontend proxies API requests to the NestJS API on port `3001`. The database is not seeded automatically.

To create a production bundle:

```bash
npm run build
```

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

The admin panel can import rows from `.xlsx` or `.csv` files for bills, budgets, budget heads, object heads, transfers, districts and users. Budget imports update an existing row when `fiscalYear` and `code` match, adding only rows without a match; blank cells leave existing values unchanged. Other entity imports remain additive and do not update or deduplicate existing records. Download a CSV template to get the exact column names. User imports require a unique username and password. For bills, any populated `budgetCode`, `objectHead`, `transferId` or `assignedUserId` must match an existing record; import the referenced tables first or leave optional reference cells blank. Rows are checked independently, and the admin reports specific row errors with a downloadable CSV report. The **Download whole database** action exports every table, including transfer history and user password hashes, to a versioned JSON backup. Keep this file private. **Replace database from backup** restores that file atomically and replaces all current records; take a fresh backup first. Restore works against the current schema and ignores fields no longer recognized by the running version.

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
  src/common/             Shared fiscal-year and bill utilities
frontend/
  src/App.tsx             App shell, workspace navigation and display controls
  src/features/           Bills, budget and transfers workspaces
  src/global.css          Design system, themes and responsive layout
  src/lib/                API client and CSV export
```

## Data and accounting notes

- Supported fiscal years are **FY 2024-25 through FY 2029-30**. **FY Total** aggregates these years and is read-only.
- The fiscal-year importer does not overwrite expenditure.
- A transferred amount affects its selected fiscal-year budget head. Edits or removal reverse the corresponding impact.
- A cleared bill linked to a transfer updates that transfer's utilization; it is not counted against budget a second time.
- Bill clearance year is derived from the clearance date in its status entry where available.
- District fund entries are tracked separately from agency transfer expenditure.

## API overview

The frontend communicates with the NestJS API. Common routes include:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/bills` | List or create bills |
| `GET` | `/bills/dashboard` | Bill pipeline summary |
| `PUT`, `DELETE` | `/bills/:id` | Update or remove a bill |
| `GET` | `/budget?fiscalYear=…` | Read a fiscal-year budget |
| `PUT` | `/budget/:fiscalYear/:code` | Update a budget row |
| `GET`, `POST` | `/transfers` | Transfer summary or create a transfer |
| `GET` | `/transfers/records` | List transfer records |
| `PUT`, `DELETE` | `/transfers/:id` | Update or remove a transfer |
| `GET` | `/search?q=…` | Search bills, budgets, transfers, districts and users |
| `GET` | `/users` | List named users |
| `POST` | `/users/login` | Sign in to the personal dashboard |
| `GET` | `/users/session` | Read the signed-in user's profile |
| `GET` | `/users/dashboard` | Read the signed-in user's scoped bills and district records |
| `GET`, `POST` | `/districts` | District summary or create a district record |
| `GET` | `/districts/records` | List district records |
| `PUT` | `/districts/:id` | Update a district record |

## Credits

**Built and developed by XHiman** — developer and project father.

**Product vision and the brains behind the project: Sandesh Joshi.**

---

<div align="center">

Made with care for clearer financial tracking.

</div>
