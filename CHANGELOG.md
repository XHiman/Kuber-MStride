# Changelog

One entry per step of the UX / trust improvement plan.

## Step 1 — Status language
- The imported "Please Check" placeholder (13 bills in the 19 Oct 2026 snapshot) is no longer shown as a status. Each bill now shows specific reasons, derived at display time: **Missing invoice no.** (8), **Missing invoice date** (6), **Reason not recorded** (5). Hold remarks map to **Awaiting handover data**, **Needs approval** or **Under query**. **Missing e-file no.** is flagged at File approval pending and Sent to treasury. Stored text, stages and totals are unchanged.
- "Needs action" now lists on-hold bills first, then every bill with a missing-data reason, and gives the next action for each. Unknown reasons are listed as action items instead of being hidden.
- Status glossary: a definition tooltip for each stage (reachable by keyboard and hover), plus a "What do these mean?" dialog that defines the six stages, "On hold / exception" and every reason.
- Labels: singular/plural bill counts ("1 bill on hold"); empty stages read "0 bills, ₹0"; "Approved, mid-pipeline" → "Committee-approved, awaiting next step"; stage names are consistent everywhere (Invoice raised … Cleared by treasury); the "Total invoice value" card shows the bill count instead of "5 stages"; "Oldest open bill" states that it excludes on-hold bills.
- Status never relies on colour alone: on-hold chips and stage flags carry a ⚠ icon and text.
- CSV export has a new "Action needed" column.
- Marathi strings added for all new text (marked TODO for native-speaker review).

## Step 0.5 — Safety net
- Vitest in both workspaces. Testing Library, jsdom, Playwright and axe-core added as dev dependencies.
- Dashboard aggregation extracted into the pure `aggregateBills()` (identical output).
- Lock-in tests: 76 bills, ₹24.07 Cr, cleared 41.08 %, stage sum = total, and an exact match with the live `/bills/dashboard` response. The real-data snapshot is gitignored.
- Before screenshots captured: light/dark × desktop/mobile × 4 tabs.
