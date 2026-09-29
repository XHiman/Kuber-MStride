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
| **Bills pipeline** | Track six clearance checkpoints, search and filter the register, review aging and exceptions, and export bills to CSV. |
| **Budget by FY** | Review provisions, expenditure and balance by object code across FY 2024-25–2029-30, or use the read-only **FY Total** view. |
| **Fund transfers** | Group transfers by recipient, record release and utilization, and track District Incentive Fund entries. |

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
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend runs on port `3000`; the NestJS API runs on port `3001`.

To create a production bundle:

```bash
npm run build
```

## Database & deployment

The Prisma SQLite database is `backend/prisma/dev.db`. Use migrations to evolve its schema while retaining records.

> **Destructive command:** `npm run db:reset` drops and recreates the local database, then seeds it. Do not use it when you need to preserve existing records.

The regular development seed loads the reference/sample data. The production-safe seed command does **not** replace bills, transfers or district records; it ensures lookup data and fiscal-year budget rows exist while preserving budget values:

```bash
npm run db:seed:production
```

For a hosted deployment, configure the service's pre-deploy step to apply pending migrations and run the production-safe seed:

```bash
npm run db:migrate:deploy && npm run db:seed:production
```

Keep the hosting build command as:

```bash
npm install && npm run build
```

Provision data separately from schema deployment. FY 2026-27 provisions are restored from the source workbook; other fiscal years should be loaded from approved figures rather than inferred.

### Import budget provisions

Prepare a CSV with the following header and one row per fiscal year and object code. Amounts are in rupees for heads A215, A224 and A233. The importer updates provisions; expenditure remains managed by transfers and eligible bill clearances.

```csv
fiscalYear,objectCode,prov215,prov224,prov233
FY 2026-27,01,10800000,4620000,50000000
```

Import it with:

```bash
npm run db:budget:import -- backend/prisma/budget.csv
```

## Repository map

```text
backend/
  prisma/                 Schema, migrations, seeds and budget importer
  src/bills/              Bill register and clearance dashboard
  src/budget/             Fiscal-year budget and totals
  src/transfers/          Transfer records and budget accounting
  src/districts/          District Incentive Fund records
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
