# Changelog

One entry per step of the UX / trust improvement plan.

## Step 5 — Bill register
- The register is now its own component (`features/bills/Register.tsx`), with pure, tested logic in `registerLogic.ts`.
- Table semantics: a visible `<caption>` ("Showing 1–25 of 76 bills · sorted by Invoice date, ascending"), `<th scope="col">`, and sortable headers (Vendor, Invoice date, Days open, Amount, Stage) that are real buttons with `aria-sort`. A new **Days open** column has Overdue flags. Missing dates and day counts sort last in both directions.
- Sticky header inside a scroll area capped at 72 % of the viewport height; pages of 25 rows with Previous/Next and an `aria-live` page counter. Filters, views and sorting reset to page 1.
- Clicking a row (or pressing Enter on its vendor button) opens a **side drawer** instead of a page. It shows all the bill's details (exact amount, days open, owner, budget code, hold remark) and the **stage timeline**, each entry with its date and time and "Changed by: not recorded" until Step 8 records the author. The drawer is `role="dialog"` and `aria-modal`, traps focus, closes with Esc or a backdrop click, and returns focus to the row. When signed in it also offers Edit bill / Move to next stage / Put on hold. This replaces the old history modal.
- Row actions are always visible in their own column instead of appearing only on hover.
- Saved views: All bills · **My assigned bills** (disabled with an explanation when signed out) · **Overdue** (23 bills) · **On hold** (1) · **Cleared this FY** (31 in FY 2026-27).
- **Export CSV** downloads the current filtered view (all pages) directly. The file starts with `# Exported: 19 Oct 2026, 17:14`, `# Filters: View = Overdue; …` and `# Rows: 23` lines, and asks for confirmation above 500 rows. A status message confirms the filename. Cells starting with `=`, `+` or `@` are neutralised so Excel cannot run them as formulas (this applies to all exports).
- The empty state lists the active filters, mentions the global search box when it is in use, and has a **Clear filters** button.
- The `?stage=` URL sync from Step 4 now runs through the register's stage filter.

## Step 4 — Pipeline stage cards
- Each stage card is a link (`?stage=invoice|pmc|tfc|file|treasury|cleared`). Clicking one filters the bill register to that stage, scrolls to it and moves focus to the register heading, which names the active stage. Clicking the active card clears the filter. Ctrl/⌘-click opens the filtered view in a new tab.
- The URL stays in sync with the register's stage filter (`replaceState`), so `?stage=tfc` deep-links and survives a refresh.
- Each card says "N bills **currently here**", and the panel says "value currently at each stage, not cumulative".
- No colour-only status: each stage has its own line icon, a number and a text label. The "needs attention" flag has ⚠ plus text, and the active card has a border and its own call-to-action text ("Showing in register · clear").
- Flow arrows: → between cards on wide screens, ↓ when cards stack on phones, hidden in the 2- and 3-column layouts where an arrow would point at the wrong card.
- "Bills moved this month" counts only real `tracked` stage changes in the current calendar month; creation rows and import snapshots don't count. Production has none yet (all 76 history rows are October imports), so the panel says "no stage moves recorded this month" instead of showing a misleading number.
- Reduced motion: no hover lift or smooth scroll.

## Step 3 — Overdue and aging
- New "Aging of open bills" panel with buckets for 0–30, 31–90, 91–180 and 180+ days, plus **No invoice date**. Each bucket shows its count and value and works as a filter toggle. All uncleared bills are counted, including on-hold ones; undated bills are shown, not dropped. On 19 Oct 2026 the split is 0 / 20 / 19 / 4 / 2, which adds up to the 45 open bills (checked by a test against the snapshot).
- Overdue threshold setting (default 90 days, remembered per browser, kept between 1 and 3650). Rows over the threshold get a ⏱ **Overdue** flag with text in the register, the aging list and Needs action; 23 bills are overdue at 90 days.
- The register now sorts **oldest first** by default, and undated bills always sort last.
- Needs action cards show the bill, days open, stage (chip), owner (or "Unassigned") and the next action. When signed in, each card has an **Assign to…** selector and either **Mark resolved** (releases the hold after confirmation) or **Fix details** (opens the bill). These are covered by component tests with mocked handlers; they were not exercised against the live API.
- Accessibility: list rows are no longer `role="button"` table rows. The vendor name in the aging list is a real button, and the tables have captions and `scope="col"`.
- Fix: hidden glossary tooltips (from Step 1) were widening the page at 360 px.
- Refactor: shared bill helpers moved to `features/bills/shared.tsx`; the aging and Needs action panels are in their own files.

## Step 2 — Money and dates
- One money format in `lib/format.ts`: ₹24.07 Cr / ₹35.4 L / full figures below ₹1 L (₹53,880), with Indian grouping and "-₹" for negatives. The `<Money>` component applies it to KPI cards, stage cards, vendor totals, Needs action, the pending and register tables, transfers and the dashboard. The exact rupee figure is always in the tooltip.
- New **Exact amounts** header toggle (remembered per browser) switches every `<Money>` to full rupee figures, so amounts can be reconciled. CSV exports and edit dialogs always use exact figures.
- Deliberate exception: the **budget object-code ledger** keeps exact figures. Its cells are edited in place and parse their own text, so a short format would turn ₹3.45 Cr into 3.45 on save.
- Dates are shown as "19 Oct 2026" everywhere: the register (previously dd/mm/yy), transfers, district release dates and stage history (previously the browser locale). Date-only values cannot shift by time zone.
- "As of 19 Oct 2026, 17:00" labels appear under each KPI group (bills, budget, transfers, districts, personal dashboard) and on each chart/list panel, using the time the data was loaded.
- Noto Sans Devanagari added as the fallback in every font stack, so Marathi renders consistently. `<meta charset="UTF-8">` was already present, and ₹ renders in both Plex fonts.
- Accessible values: stage bars are decorative (`aria-hidden`) because the value and count are in the text; each vendor bar has an `aria-label` with its cleared, in-progress and on-hold values.
- Backend fix (shown by a new test): `fmtIN` printed "₹,500" for amounts under ₹1,000, and `fmtShort` printed "₹-35.4 L".

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
