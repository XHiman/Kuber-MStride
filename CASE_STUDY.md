# Case study: making a government bill tracker clear, trustworthy and efficient

**Product:** MahaSTRIDE Bill & Budget Tracker, a finance workspace used by MahaSTRIDE's finance team and its District Support Units (DSUs).
**Scope:** one redesign pass in 12 steps, each committed and tested separately (19 Oct 2026). Before and after screenshots are in `SCREENSHOTS/before` and `SCREENSHOTS/after`: light and dark, desktop (1440 px) and mobile (360 px), four tabs each.

## The problem

Staff use the tracker to answer three questions: *Where is each bill? What is stuck, and why? Who has to act?* The original interface made these hard to answer:

- **Vague status.** 13 of 76 bills showed "Please Check" (an imported placeholder) in their status, payment attribute or even invoice number. 8 of those were already cleared but had no invoice number.
- **Numbers without context.** Mixed money formats (₹1,10,20,140 next to ₹1.10 Cr), dd/mm/yy dates, no indication of how fresh figures were, and pipeline values whose meaning (cumulative or current) users had to guess.
- **Hidden urgency.** The oldest open bill was **377 days** old, yet nothing marked bills as overdue. The register defaulted to sorting by amount, and the "Needs Action" list only showed the one held bill.
- **Fragmented identities.** "Nagpur - E & Y" and "DSU Nagpur- E & Y" appeared as two vendors, and the per-vendor bars were each scaled to 100 %, so vendors could not be compared.
- **No trail.** Stage history had no author or reason, and nothing could be undone.
- **Accessibility debt.** axe-core found **252 failing nodes** (mostly contrast) and two layouts scrolled sideways on phones.

## Principles

1. **Never change the numbers to make the UI nicer.** Before touching the UI, tests locked the totals against a production snapshot: 76 bills, ₹24.07 Cr, 41.08 % cleared, stage values summing to the total, and an exact match with the live dashboard API. Every later step had to keep them green.
2. **Name the next action, not the problem.** Every exception says what to do next and who owns it.
3. **Show uncertainty honestly.** "Not recorded", "no stage moves recorded this month" and "as of 17:56" instead of silent defaults or invented activity.
4. **Never rely on colour alone.** Every stage, flag and status has an icon and a text label, and chart colours were *computed* (validated for colour-vision deficiency and contrast in both themes), not picked by eye.

## What changed (highlights)

| Area | Before | After |
| --- | --- | --- |
| Status language | "Please Check" | Derived reasons: *Missing invoice no.* (8), *Missing invoice date* (6), *Reason not recorded* (5), *Awaiting handover data*, plus a stage glossary in tooltips and a "What do these mean?" dialog |
| Money and dates | Three formats | One rule (₹24.07 Cr / ₹35.4 L / ₹53,880), exact rupees in tooltips plus an **Exact amounts** toggle, "19 Oct 2026", "As of …" on every KPI group |
| Urgency | None | Aging buckets with count and value, configurable Overdue flag (23 bills > 90 days), oldest-first register, Needs action cards showing days open, stage, owner, next action, Assign and Mark resolved |
| Pipeline | Static cards | Cards that filter the register (`?stage=tfc`), "currently here" wording, icons, flow arrows |
| Register | Hover-only actions, new page per bill | Real table semantics, sortable `aria-sort` headers, sticky header, 25-row pages, saved views, side drawer with timeline, filtered CSV that lists its filters |
| Vendors | 23 raw names, 100 % bars | 21 normalised vendors (raw names in tooltips), a sorted bar chart from zero with values and counts, a By DSU toggle, and a table alternative |
| Trust | No author or reason | Who / when / why on every stage move, hold and release; "Last updated" in the header; 10-second Undo that keeps both history entries; account-number masking |
| Access | 252 axe failures | **0** in light and dark; no sideways scroll at 360 px or 200 % zoom; focus rings; reduced motion; System/Light/Dark theme |
| Language | Partial Marathi | 0 untranslated interface strings (automated check), translated server errors, `lang="en"` on English data |

## Trade-offs worth discussing

- **One format vs exact amounts.** Finance staff reconcile to the rupee. The compact format wins for scanning; the toggle and tooltips keep exactness one step away. The budget ledger is a deliberate exception: its cells are edited in place, so a compact format would corrupt the data on save.
- **Derived vs stored reasons.** Deriving reasons from missing fields fixed all 13 placeholders without a data migration or any change to stage inference. The cost is that a reason is only as good as the inference, so unknown cases say *Reason not recorded* openly.
- **Roles as a placeholder.** A DSU-scoped dashboard was easy to build, but restricting the API would have changed who can see what across the organisation. That decision belongs to the owners, so the role is labelled as a placeholder and documented as "not access control".
- **Undo keeps history.** Undo writes a second entry instead of deleting the first, because an audit trail that can be erased is not an audit trail.

## Evaluation

- **Automated:** 89 unit and component tests, an axe audit and a Marathi coverage check, all runnable from `npm` scripts.
- **Planned with users:** an opt-in, anonymised usage log measures **time to find an overdue bill** (page load → first overdue bill opened), which filters people use and which errors they hit, with no names, search text or values recorded. A one-line **Feedback** button on every page collects qualitative comments. Suggested study: five finance and five DSU users, three tasks (find the oldest overdue bill and its owner; export this quarter's TFC-stage bills; explain why a held bill is stuck), compared against baseline timings on the old build.

## Notes for readers

- Figures are from the production snapshot of 19 Oct 2026. A record edited on production later that day changed the total by ₹0.60, so the "after" screenshots differ from "before" by that amount.
- Open items: native-speaker review of the Marathi strings, a manual screen-reader pass, real role-based access control, and the planned user study.
