import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seed data extracted from the HTML file's <script id="seed-*"> blocks
// and cross-referenced with the Excel workbook.

const BILLS = [
  // PMC - KPMG
  { sr: 1, vendor: "PMC - KPMG", invoice: "KASP-MH/100069", date: "2026-05-25", amount: 3657952, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 05.08.2026 File for submission email received", attribute: "10% deliverable-based payment (PMC advisory)", note: "TFC approved; file being put up for release", days: 111, source: "seed" },
  { sr: 1, vendor: "PMC - KPMG", invoice: "KASP-MH/A100127", date: "2026-06-11", amount: 1024240, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Nov 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },

  // DSU Nashik-KPMG
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/900709", date: "2026-05-29", amount: 4633825, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Jan 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100228", date: "2026-05-31", amount: 5067348, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Feb 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100218", date: "2026-05-31", amount: 5158115, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Mar 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100345", date: "2026-06-29", amount: 5334952, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 05.08.2026 File for submission", attribute: "Monthly service fee — Apr 2026", note: "TFC approved; file being put up for release", days: 76, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100536", date: "2026-07-30", amount: 5175888, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 10.08.2026", attribute: "Monthly service fee — May 2026", note: "Invoice received — PMC check pending", days: 45, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100566", date: "2026-07-30", amount: 5087025, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 18.08.2026", attribute: "Monthly service fee — Jun 2026", note: "Invoice received — PMC check pending", days: 45, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100611", date: "2026-08-13", amount: 3431999, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 18.08.2026", attribute: "Inception report deliverable", note: "Invoice received — PMC check pending", days: 31, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100616", date: "2026-08-14", amount: 4290000, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 18.08.2026", attribute: "Private capital mobilization deliverable", note: "Invoice received — PMC check pending", days: 30, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100627", date: "2026-08-18", amount: 10296000, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 18.08.2026", attribute: "Public disclosure deliverable", note: "Invoice received — PMC check pending", days: 26, source: "seed" },
  { sr: 2, vendor: "DSU Nashik-KPMG", invoice: "KASP-HR/A100702", date: null, amount: 5087025, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 02.09.2026", attribute: "Monthly service fee — Jul 2026", note: "Invoice received — PMC check pending", days: null, source: "seed" },

  // DSU Pune - STC
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/DSU/Pune/005", date: "2026-03-18", amount: 2512984, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Oct 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/DSU/Pune/006", date: "2026-03-18", amount: 2760750, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Nov 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/DSU/Pune/007", date: "2026-03-18", amount: 2681371, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Dec 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/8", date: "2026-05-08", amount: 2610484, bucket: "Put Up on File", cat: "on_hold", status: "File Submitted 31.07.2026 Objected", attribute: "Monthly service fee — Jan 2026", note: "Filed but objected at district/reviewing level — needs resolution", days: 128, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/9", date: "2026-05-08", amount: 2475000, bucket: "Put Up on File", cat: "on_hold", status: "File Submitted 31.07.2026 Kolhapur Obj Konale", attribute: "Monthly service fee — Feb 2026", note: "Filed but objected at district/reviewing level — needs resolution", days: 128, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/10", date: "2026-07-15", amount: 2649194, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 05.08.2026 File submitted", attribute: "Monthly service fee — Mar 2026", note: "File submitted, pending treasury submission", days: 60, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/11", date: "2026-07-15", amount: 7307019, bucket: "PMC Check", cat: "on_hold", status: "Report awaited", attribute: "25% installment — Jun'25 to Mar'26", note: "Deliverable/MPR report awaited before PMC check", days: 60, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/12", date: "2026-07-15", amount: 2812500, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 05.08.2026 File submitted", attribute: "Monthly service fee — Apr 2026", note: "File submitted, pending treasury submission", days: 60, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/13", date: "2026-08-19", amount: 2741492, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 20.08.2026", attribute: "Monthly service fee — May 2026", note: "Invoice received — PMC check pending", days: 25, source: "seed" },
  { sr: 3, vendor: "DSU Pune - STC", invoice: "MahaSTRIDE/14", date: "2026-08-20", amount: 5553334, bucket: "Invoice Raised", cat: "in_progress", status: "Received Proforma invoice 20.08.2026", attribute: "25% remuneration installment — Jun'25 to Mar'26", note: "Invoice received — PMC check pending", days: 24, source: "seed" },

  // DSU CSN- Choice
  { sr: 4, vendor: "DSU CSN- Choice", invoice: "CCS/25-26/02-75", date: "2026-02-16", amount: 5782137, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 10.08.2026", attribute: "Monthly service fee — Jan 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 4, vendor: "DSU CSN- Choice", invoice: "CCS/25-26/03-84", date: "2026-03-16", amount: 4757544, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 10.08.2026", attribute: "Monthly service fee — Feb 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 4, vendor: "DSU CSN- Choice", invoice: "CCS/25-26/04-47", date: "2026-04-23", amount: 3537097, bucket: "Put Up on File", cat: "on_hold", status: "Bill file submited 15.07.2026 Objection achievement", attribute: "Monthly service fee — Mar 2026", note: "Filed but objected at district/reviewing level — needs resolution", days: 143, source: "seed" },
  { sr: 4, vendor: "DSU CSN- Choice", invoice: "CCS/26-27/06-107", date: "2026-06-26", amount: 5280000, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 10.08.2026", attribute: "5% mobilization advance — private capital", note: "Invoice received — PMC check pending", days: 79, source: "seed" },
  { sr: 4, vendor: "DSU CSN- Choice", invoice: "CCS/26-27/06-108", date: "2026-06-26", amount: 4224000, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 10.08.2026", attribute: "4% — AAP submission to DSP", note: "Invoice received — PMC check pending", days: 79, source: "seed" },
  { sr: 4, vendor: "DSU CSN- Choice", invoice: "CCS/26-27/06-110", date: "2026-06-26", amount: 4224000, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 10.08.2026", attribute: "4% — progress on intervention", note: "Invoice received — PMC check pending", days: 79, source: "seed" },
  { sr: 4, vendor: "DSU CSN- Choice", invoice: "CCS/26-27/06-109", date: "2026-06-26", amount: 2112001, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 10.08.2026", attribute: "2% — progress on intervention", note: "Invoice received — PMC check pending", days: 79, source: "seed" },

  // DSU Amra Linpico
  { sr: 5, vendor: "DSU Amra Linpico", invoice: "40/2025-26", date: "2026-03-18", amount: 1405176, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Jan 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 5, vendor: "DSU Amra Linpico", invoice: "42/2025-26", date: "2026-03-27", amount: 1602686, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Feb 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 5, vendor: "DSU Amra Linpico", invoice: "03/2026-27", date: "2026-06-11", amount: 1552946, bucket: "TFC/TEC Committee Approval", cat: "in_progress", status: "Approved by committee File for submitted", attribute: "Monthly service fee — Mar 2026", note: "Approved by committee", days: 94, source: "seed" },
  { sr: 5, vendor: "DSU Amra Linpico", invoice: "04/2026-27", date: "2026-07-11", amount: 1625749, bucket: "TFC/TEC Committee Approval", cat: "in_progress", status: "Approved by committee File for submitted", attribute: "Monthly service fee — Apr 2026", note: "Approved by committee", days: 64, source: "seed" },
  { sr: 5, vendor: "DSU Amra Linpico", invoice: "14/2026-27", date: "2026-08-25", amount: 2350861, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 25.08.2026", attribute: "Monthly service fee — May 2026", note: "Invoice received — PMC check pending", days: 19, source: "seed" },
  { sr: 5, vendor: "DSU Amra Linpico", invoice: "15/2026-27", date: "2026-08-25", amount: 2583790, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 25.08.2026", attribute: "Monthly service fee — Jun 2026", note: "Invoice received — PMC check pending", days: 19, source: "seed" },
  { sr: 5, vendor: "DSU Amra Linpico", invoice: "13/2026-27", date: "2026-08-25", amount: 4774938, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 25.08.2026", attribute: "Clearance of approved CVs — Jul'25 to Apr'26", note: "Invoice received — PMC check pending", days: 19, source: "seed" },

  // DSU Nagpur- E & Y
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR6L029540", date: "2026-02-17", amount: 840953, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 24.04.2026", attribute: "Monthly service fee — Jul 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR6L029397", date: "2027-02-17", amount: 2215560, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 24.04.2026", attribute: "Monthly service fee — Aug 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR6L029396", date: null, amount: 4084337, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 24.04.2026", attribute: "Monthly service fee — Sep 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR6L030924", date: null, amount: 5703517, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 24.04.2026", attribute: "Monthly service fee — Oct 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR6L030925", date: null, amount: 5685511, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 24.04.2026", attribute: "Monthly service fee — Nov 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR6L030926", date: null, amount: 5687393, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 24.04.2026", attribute: "Monthly service fee — Dec 2025", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR6L030927", date: null, amount: 5711580, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 24.04.2026", attribute: "Monthly service fee — Jan 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L033250", date: "2026-03-11", amount: 5734901, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Feb 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L003872", date: "2026-05-14", amount: 5727703, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Mar 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L004147", date: "2026-05-19", amount: 11028148, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 08.07.2026 File for submission", attribute: "12% milestone-based payment", note: "TFC approved; file being put up for release", days: 117, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L004148", date: "2026-05-19", amount: 4595062, bucket: "PMC Check", cat: "on_hold", status: "IVA report is still not received", attribute: "5% deliverable-based payment", note: "IVA report awaited before PMC can clear", days: 117, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L005348", date: "2026-06-03", amount: 3676049, bucket: "PMC Check", cat: "on_hold", status: "Div Comm acceptance confirmation not/received.", attribute: "4% half-yearly payment", note: "Divisional Commissioner acceptance confirmation awaited", days: 102, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L004146", date: "2026-05-19", amount: 5710504, bucket: "Treasury Clearance", cat: "cleared", status: "Bill PASSED on 04.08.2026", attribute: "Monthly service fee — Apr 2026", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L007128", date: "2026-06-22", amount: 5703517, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 05.08.2026 File for submission", attribute: "Monthly service fee — May 2026", note: "TFC approved; file being put up for release", days: 83, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L011745", date: "2026-08-12", amount: 5743827, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 31.08.2026", attribute: "Monthly service fee — Jun 2026", note: "Invoice received — PMC check pending", days: 32, source: "seed" },
  { sr: 6, vendor: "DSU Nagpur- E & Y", invoice: "IN91HR7L011976", date: "2026-08-14", amount: 5743827, bucket: "Invoice Raised", cat: "in_progress", status: "Received Tax invoice 31.08.2026", attribute: "Monthly service fee — Jul 2026", note: "Invoice received — PMC check pending", days: 30, source: "seed" },

  // ICARE
  { sr: 7, vendor: "ICARE", invoice: "Milestone 1", date: "2026-06-01", amount: 1345257, bucket: "Sent to Treasury", cat: "in_progress", status: "In Treausary Order 05.08.2026", attribute: "Milestone 1 payment", note: "Treasury order issued", days: 104, source: "seed" },
  { sr: 7, vendor: "ICARE", invoice: "MPR based", date: null, amount: 1139128, bucket: "Sent to Treasury", cat: "in_progress", status: "Bill to be PASSED on 19.08.2026", attribute: "MPR-based monthly payment — May 2026", note: "At treasury — clearance date scheduled", days: null, source: "seed" },
  { sr: 7, vendor: "ICARE", invoice: "ICARE/M/2627/003", date: "2026-07-01", amount: 1307888, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 05.08.2026 File for submission", attribute: "Monthly service fee — Jun 2026", note: "TFC approved; file being put up for release", days: 74, source: "seed" },
  { sr: 7, vendor: "ICARE", invoice: "ICARE/M/2627/004", date: "2026-08-01", amount: 1307888, bucket: "Invoice Raised", cat: "in_progress", status: "Received 13.08.2026", attribute: "Monthly service fee — Jul 2026", note: "Invoice received — PMC check pending", days: 43, source: "seed" },

  // RELTEL
  { sr: 8, vendor: "RELTEL", invoice: "2627103594", date: "2026-08-06", amount: 690054, bucket: "Sent to Treasury", cat: "in_progress", status: "Bill Submitted to Treausary 18.08.2026", attribute: "Monthly service fee — Apr 2026", note: "Bill submitted to treasury, awaiting clearance", days: 38, source: "seed" },
  { sr: 8, vendor: "RELTEL", invoice: "2627103595", date: "2026-08-06", amount: 740804, bucket: "Sent to Treasury", cat: "in_progress", status: "Bill Submitted to Treausary 18.08.2026", attribute: "Monthly service fee — May 2026", note: "Bill submitted to treasury, awaiting clearance", days: 38, source: "seed" },
  { sr: 8, vendor: "RELTEL", invoice: "2627103596", date: "2026-08-06", amount: 770488, bucket: "Sent to Treasury", cat: "in_progress", status: "Bill Submitted to Treausary 18.08.2026", attribute: "Monthly service fee — Jun 2026", note: "Bill submitted to treasury, awaiting clearance", days: 38, source: "seed" },

  // AI Training Karjat
  { sr: 9, vendor: "AI Training Karjat", invoice: "06/2026-27", date: "2026-05-28", amount: 700330, bucket: "Treasury Clearance", cat: "cleared", status: "Bill Passed 07.07.2026", attribute: "Training session invoice", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
  { sr: 9, vendor: "AI Training Karjat", invoice: "09/2026-27", date: "2026-07-29", amount: 624810, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 05.08.2026 File for submission", attribute: "Training session invoice — 13–14 Jul", note: "TFC approved; file being put up for release", days: 46, source: "seed" },
  { sr: 9, vendor: "AI Training Karjat", invoice: "10/2026-27", date: "2026-07-29", amount: 631300, bucket: "Put Up on File", cat: "in_progress", status: "Approved by committee 05.08.2026 File for submission", attribute: "Training session invoice — 27–28 Jul", note: "TFC approved; file being put up for release", days: 46, source: "seed" },

  // DMO Workshop (TRIDENT)
  { sr: 10, vendor: "DMO Workshop (TRIDENT)", invoice: "(unlabeled)", date: "2026-05-12", amount: 329987, bucket: "Treasury Clearance", cat: "cleared", status: "Bill Passed 30.07.2026", attribute: "Workshop invoice — TRIDENT, Chandrapur", note: "Bill passed / cleared by treasury", days: null, source: "seed" },
];

const BUDGET_HEADS = [
  { code: "A215", name: "IPF 70 % Bank Share", description: "IPF 70 % Bank Share" },
  { code: "A224", name: "IPF 30% State Share", description: "IPF 30% State Share" },
  { code: "A233", name: "70% PforR - Bank Share", description: "70% PforR - Bank Share" },
];

const OBJECT_HEADS = [
  { code: "01", name: "Salary", nameMr: "वेतन" },
  { code: "06", name: "Telephone/Electricity/Water", nameMr: "दूरध्वनी, वीज व पाणी शुल्क" },
  { code: "10", name: "Contractual Services", nameMr: "कंत्राटी सेवा" },
  { code: "11", name: "Domestic Travel", nameMr: "देशांतर्गत प्रवास खर्च" },
  { code: "13", name: "Office Expenses", nameMr: "कार्यालयीन खर्च" },
  { code: "14", name: "Rent and Taxes", nameMr: "भाडेपट्टी व कर" },
  { code: "16", name: "Publications", nameMr: "प्रकाशने" },
  { code: "17", name: "Computer Expenses", nameMr: "संगणक खर्च" },
  { code: "21", name: "Supplies and Materials", nameMr: "पुरवठा व सामुग्री" },
  { code: "24", name: "Petrol/Oil/Lubricant", nameMr: "पेट्रोल, तेल व वंगण" },
  { code: "26", name: "Advertisement and Publicity", nameMr: "जाहिरात व प्रसिद्धी" },
  { code: "27", name: "Minor Works", nameMr: "लहान बांधकामे" },
  { code: "28", name: "Professional Services", nameMr: "व्यावसायिक सेवा" },
  { code: "31", name: "Grant-in-aid (non-salary)", nameMr: "सहाय्यक अनुदान (वेतनेतर)" },
];

const BUDGET = [
  { id: "01", code: "01", name: "Salary", nameMr: "वेतन", prov215: 10800000, exp215: 0, prov224: 4620000, exp224: 0, prov233: 50000000, exp233: 0 },
  { id: "06", code: "06", name: "Telephone / Electricity / Water", nameMr: "दूरध्वनी, वीज व पाणी शुल्क", prov215: 3500000, exp215: 0, prov224: 1500000, exp224: 0, prov233: 20000000, exp233: 0 },
  { id: "10", code: "10", name: "Contractual Services", nameMr: "कंत्राटी सेवा", prov215: 495800000, exp215: 160192277, prov224: 212500000, exp224: 51054461, prov233: 200000000, exp233: 50543968 },
  { id: "11", code: "11", name: "Domestic Travel", nameMr: "देशांतर्गत प्रवास खर्च", prov215: 7000000, exp215: 0, prov224: 3000000, exp224: 0, prov233: 20000000, exp233: 0 },
  { id: "13", code: "13", name: "Office Expenses", nameMr: "कार्यालयीन खर्च", prov215: 14000000, exp215: 0, prov224: 6000000, exp224: 0, prov233: 300000000, exp233: 21486155 },
  { id: "14", code: "14", name: "Rent & Taxes", nameMr: "भाडेपट्टी व कर", prov215: 14000000, exp215: 0, prov224: 6000000, exp224: 0, prov233: 50000000, exp233: 4779000 },
  { id: "16", code: "16", name: "Publications", nameMr: "प्रकाशने", prov215: 1000, exp215: 0, prov224: 1000, exp224: 0, prov233: 1000, exp233: 0 },
  { id: "17", code: "17", name: "Computer Expenses", nameMr: "संगणक खर्च", prov215: 35000000, exp215: 0, prov224: 15000000, exp224: 0, prov233: 600000000, exp233: 4701346 },
  { id: "21", code: "21", name: "Supplies & Materials", nameMr: "पुरवठा व सामुग्री", prov215: 1000, exp215: 0, prov224: 1000, exp224: 0, prov233: 10000000, exp233: 0 },
  { id: "24", code: "24", name: "Petrol / Oil / Lubricant", nameMr: "पेट्रोल, तेल व वंगण", prov215: 1000, exp215: 0, prov224: 1000, exp224: 0, prov233: 5000000, exp233: 0 },
  { id: "26", code: "26", name: "Advertisement & Publicity", nameMr: "जाहिरात व प्रसिध्दी", prov215: 58800000, exp215: 0, prov224: 25200000, exp224: 0, prov233: 60000000, exp233: 500000 },
  { id: "27", code: "27", name: "Minor Works", nameMr: "लहान बांधकामे", prov215: 1000, exp215: 0, prov224: 1000, exp224: 0, prov233: 244999000, exp233: 0 },
  { id: "28", code: "28", name: "Professional Services", nameMr: "व्यावसायिक सेवा", prov215: 110800000, exp215: 0, prov224: 47500000, exp224: 0, prov233: 80000000, exp233: 0 },
  { id: "31", code: "31", name: "Grants-in-aid (non-salary)", nameMr: "सहाय्यक अनुदान (वेतनेतर)", prov215: 7000000, exp215: 0, prov224: 3000000, exp224: 0, prov233: 550000000, exp233: 349600000 },
];

const TRANSFERS = [
  { recipient: "Dept. of Tourism (DoT)", purpose: "Contractual Services", objectCode: "10", amount: 2086240, orderDate: null, status: "minutes_awaited", utilized: 0, remarks: "Minutes of the meeting awaited before release", source: "seed" },
  { recipient: "Dept. of Industries (DoI)", purpose: "Computer", objectCode: "17", amount: 2500000, orderDate: "2026-08-06", status: "transferred", utilized: 0, remarks: null, source: "seed" },
  { recipient: "Dept. of Industries (DoI)", purpose: "Advertisement", objectCode: "26", amount: 500000, orderDate: "2026-08-06", status: "transferred", utilized: 0, remarks: null, source: "seed" },
  { recipient: "CES", purpose: "Contractual Services", objectCode: "10", amount: 39618000, orderDate: "2026-07-03", status: "transferred", utilized: 0, remarks: null, source: "seed" },
  { recipient: "CES", purpose: "Office Expenses", objectCode: "13", amount: 15166000, orderDate: "2026-07-03", status: "transferred", utilized: 0, remarks: null, source: "seed" },
  { recipient: "Chandrapur Workshop (TRIDENT)", purpose: "Workshop — main bill", objectCode: "13", amount: 3562329, orderDate: null, status: "transferred", utilized: 0, remarks: "Rs.5,00,000/- to be paid", source: "seed" },
  { recipient: "Chandrapur Workshop (TRIDENT)", purpose: "Workshop — anchor", objectCode: "13", amount: 15000, orderDate: null, status: "transferred", utilized: 0, remarks: "Anchor in Programme", source: "seed" },
  { recipient: "7th floor office", purpose: "Rent — Zip pipes", objectCode: "14", amount: 2867400, orderDate: null, status: "transferred", utilized: 0, remarks: null, source: "seed" },
  { recipient: "Tata Tele Business", purpose: "Internet", objectCode: "17", amount: 137666, orderDate: null, status: "transferred", utilized: 0, remarks: null, source: "seed" },
  { recipient: "Office admin", purpose: "Stationery", objectCode: "13", amount: 25146, orderDate: null, status: "transferred", utilized: 0, remarks: null, source: "seed" },
  { recipient: "SDA + other officers", purpose: "Salary", objectCode: "01", amount: 1956000, orderDate: null, status: "transferred", utilized: 0, remarks: null, source: "seed" },
];

const DISTRICTS = [
  // Konkan division
  { district: "Mumbai City", division: "Konkan", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Mumbai Suburban", division: "Konkan", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Thane", division: "Konkan", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Palghar", division: "Konkan", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Raigad", division: "Konkan", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Ratnagiri", division: "Konkan", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Sindhudurg", division: "Konkan", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  // Pune division
  { district: "Pune", division: "Pune", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Satara", division: "Pune", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Sangli", division: "Pune", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Kolhapur", division: "Pune", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Solapur", division: "Pune", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  // Nashik division
  { district: "Nashik", division: "Nashik", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Dhule", division: "Nashik", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Nandurbar", division: "Nashik", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Jalgaon", division: "Nashik", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Ahilyanagar (Ahmednagar)", division: "Nashik", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  // Chhatrapati Sambhajinagar division
  { district: "Chhatrapati Sambhajinagar (Aurangabad)", division: "Chhatrapati Sambhajinagar", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Jalna", division: "Chhatrapati Sambhajinagar", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Beed", division: "Chhatrapati Sambhajinagar", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Latur", division: "Chhatrapati Sambhajinagar", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Dharashiv (Osmanabad)", division: "Chhatrapati Sambhajinagar", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Nanded", division: "Chhatrapati Sambhajinagar", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Parbhani", division: "Chhatrapati Sambhajinagar", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Hingoli", division: "Chhatrapati Sambhajinagar", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  // Amravati division
  { district: "Amravati", division: "Amravati", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Akola", division: "Amravati", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Washim", division: "Amravati", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Buldhana", division: "Amravati", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Yavatmal", division: "Amravati", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  // Nagpur division
  { district: "Nagpur", division: "Nagpur", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Wardha", division: "Nagpur", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Chandrapur", division: "Nagpur", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Gadchiroli", division: "Nagpur", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Gondia", division: "Nagpur", amount: 0, releaseDate: null, remarks: null, source: "seed" },
  { district: "Bhandara", division: "Nagpur", amount: 0, releaseDate: null, remarks: null, source: "seed" },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.bill.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.objectHead.deleteMany();
  await prisma.budgetHead.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.district.deleteMany();

  // Seed bills
  for (const bill of BILLS) {
    await prisma.bill.create({
      data: {
        ...bill,
        date: bill.date ? new Date(bill.date + 'T00:00:00') : null,
      },
    });
  }

  for (const head of BUDGET_HEADS) {
    await prisma.budgetHead.create({ data: head });
  }

  for (const head of OBJECT_HEADS) {
    await prisma.objectHead.create({ data: head });
  }

  // Seed budget
  for (const b of BUDGET) {
    await prisma.budget.upsert({
      where: { code: b.code },
      update: b,
      create: b,
    });
  }

  // Seed transfers
  for (const t of TRANSFERS) {
    await prisma.transfer.create({
      data: {
        ...t,
        orderDate: t.orderDate ? new Date(t.orderDate + 'T00:00:00') : null,
      },
    });
  }

  // Seed districts
  for (const d of DISTRICTS) {
    await prisma.district.create({
      data: {
        ...d,
        releaseDate: d.releaseDate ? new Date(d.releaseDate + 'T00:00:00') : null,
      },
    });
  }

  console.log(`✅ Seeded ${BILLS.length} bills, ${BUDGET.length} budget records, ${TRANSFERS.length} transfers, ${DISTRICTS.length} districts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
