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
| **Dashboard** | Name a browser device and see personal bill and district work. User/device records and program/district scopes are maintained on the backend, not exposed as a user-facing tab. |

The global search bar searches bills, budgets, transfers, districts and people from any tab. Exports first copy the full CSV-formatted table to the clipboard; a CSV download action appears after a successful copy.

Device profiles use a persistent browser identifier and record the request IP address and user-agent for recognition. The name prompt can be dismissed. A developer can correct `user_devices.ipAddress`, remap a device through `user_devices.userId`, and maintain user program/district scopes in the backend database; there is no separate administrator login in this application.

## Built with

- **Frontend:** React 18, TypeScript and Vite
- **Backend:** NestJS 10 and TypeScript
- **Data access:** Prisma 5
- **Database:** SQLite by default (`backend/prisma/dev.db`)

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

Local development uses `backend/prisma/dev.db` via `DATABASE_URL=file:./dev.db`. This repository does not seed, reset, or import records during builds or deployments.

**Production SQLite must live on a persistent disk, never in the deployed repository.** Before the next Render deploy, attach a persistent disk mounted at `/var/data`, copy the active production SQLite file to `/var/data/mitra.db` without overwriting it from the repository, and set `DATABASE_URL=file:/var/data/mitra.db` plus `DATABASE_PERSISTENT_DIR=/var/data`. The backend refuses to start if the configured production database is outside the persistent mount or missing; it will not silently create a new empty database after a deploy. Keep builds limited to `npm install && npm run build`; migrations, if needed, are separate, reviewed schema-only commands and must target the same persistent `DATABASE_URL`. Do not use seed, reset, or import commands in production.

For a hosted deployment, configure the pre-deploy step to apply pending schema migrations only:

```bash
npm run db:migrate:deploy
```

Keep the hosting build command as:

```bash
npm install && npm run build
```

For the Render Static Site that serves the frontend, set its **Publish Directory** to `frontend/dist` and its build environment variable `VITE_API_URL` to the backend web service's public base URL (for example, `https://your-backend-service.onrender.com`, without a trailing slash). The regular API client and `/adminX/api` both use this value. The build emits an `/adminX/index.html` entry so the admin URL works on direct navigation and refresh without a separate rewrite rule.

Legacy seed/import files are disabled in production and their package scripts have been removed. The development seed is destructive and requires explicit `ALLOW_DESTRUCTIVE_DEV_SEED=true`; a development budget import requires `ALLOW_BUDGET_IMPORT=true`. Do not set these variables in production.

### Admin panel

Open `/adminX` to sign in and manage bills, budgets, budget heads, object heads, transfers, districts, users and browser devices. The panel uses an expiring, tab-scoped signed session so authentication works when the static frontend and API are hosted on separate origins. For local development, copy `backend/.env.example` to `backend/.env` and replace the placeholder values with a new password and a random `ADMIN_SESSION_SECRET` of at least 32 characters. The backend loads this file on startup; it is git-ignored. In production, configure the admin values as server-only deployment secrets. Never place credentials in frontend variables or source control. Rotate any password previously shared in chat before deployment. Unnamed devices can view tracker records; saving a device name enables editing unless an administrator has disabled that device. Existing device access is preserved by the additive access-control migration.

## Repository map

```text
backend/
  prisma/                 Schema, migrations, seeds and budget importer
  src/bills/              Bill register and clearance dashboard
  src/budget/             Fiscal-year budget and totals
  src/transfers/          Transfer records and budget accounting
  src/districts/          District Incentive Fund records
  src/users/               Device profiles and personal dashboard scopes
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
| `POST` | `/users/device` | Record a browser device, request IP and user-agent |
| `POST` | `/users/claim` | Assign a name to the current browser device |
| `GET` | `/users/dashboard/:id` | Read the selected user's scoped bills and district records |
| `PUT` | `/users/:id` | Update a user's program and district scope |
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
