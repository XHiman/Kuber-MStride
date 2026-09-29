# MahaSTRIDE Bill & Budget Tracker

A Nest.js + React application for tracking bill clearance pipeline, FY 2026-27 budget by object code, and agency fund transfers — recreated from the standalone HTML reference file.

## Project Structure

```
mahastride-tracker/
├── backend/
│   ├── src/
│   │   ├── bills/          # Bill CRUD + dashboard aggregation
│   │   ├── budget/         # Budget object-code table
│   │   ├── transfers/      # Fund transfers (DDO records)
│   │   ├── districts/      # District Incentive Fund
│   │   ├── dashboard/      # Combined dashboard endpoint
│   │   ├── prisma/         # Prisma service + module
│   │   ├── common/         # Shared utilities (bill-utils.ts)
│   │   └── main.ts         # Entry point
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.ts         # Seed data from HTML + Excel
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── features/       # Tab components (bills, budget, transfers)
│   │   ├── lib/            # API client
│   │   ├── types/          # TypeScript interfaces
│   │   ├── styles/         # Global CSS (mirrors HTML reference)
│   │   └── App.tsx         # Root component
│   └── package.json
└── README.md
```

## Quick Start

```bash
# Install all dependencies
npm install

# Generate Prisma client
npm run db:generate

# Seed the local development database with data from the HTML/Excel reference
npm run db:seed

# Ensure hosted lookup data without replacing existing production records
npm run db:seed:production

# Run both backend (port 3001) and frontend (port 3000)
npm run dev
```

Open http://localhost:3000 in your browser.

## Database

The local SQLite database is at `backend/prisma/dev.db`. To reset it:

```bash
npm run db:reset
```

This drops all tables and re-seeds from the source data.

The production seed command (or `NODE_ENV=production npm run db:seed`) does not
delete or repopulate historical bills, transfers, or district records. It only
ensures required budget/object-head lookup rows and zero-value budget rows
exist, preserving any existing budget values. Enter production records through
the frontend.

## Where to Edit

- **Business logic** (bill stage inference, FY calculation): `backend/src/common/bill-utils.ts`
- **UI styles**: `frontend/src/styles/global.css`
- **Data models**: `backend/prisma/schema.prisma`
- **Seed data**: `backend/prisma/seed.ts`
- **Tab components**: `frontend/src/features/`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bills` | List bills (with query params) |
| GET | `/bills/dashboard` | Dashboard aggregation stats |
| POST | `/bills` | Create a bill |
| PUT | `/bills/:id` | Update a bill |
| DELETE | `/bills/:id` | Delete a bill |
| GET | `/budget` | Budget totals + rows |
| PUT | `/budget/:code` | Update budget expenditure |
| GET | `/transfers/records` | All transfer records |
| POST | `/transfers` | Create transfer |
| PUT | `/transfers/:id` | Update transfer |
| GET | `/districts/records` | All district records |
| PUT | `/districts/:id` | Update district record |

## Query Parameters for Bills

- `search` — search vendor, invoice, or status
- `vendor` — filter by vendor name
- `stage` — filter by pipeline stage (bucket)
- `cat` — filter by category (`cleared`, `in_progress`, `on_hold`)
- `sortBy` — sort field (default: `amount`)
- `sortDir` — `asc` or `desc`

## Notes on Source Data

- Bill data is seeded from the HTML file's `<script id="seed-bills">` block, cross-referenced with the Excel workbook.
- Budget figures are from the STATUS workbook's EXPEND sheet (FY 2026-27, as on 6 Aug 2026).
- Fund-transfer utilization starts at ₹0 for every seeded row.
- District Incentive Fund has all 36 districts listed by division; amounts start blank.
- Bill stage is inferred from free-text status using the same rules as the original HTML.
