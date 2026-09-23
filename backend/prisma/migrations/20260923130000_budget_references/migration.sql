-- CreateTable
CREATE TABLE "budget_heads" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "object_heads" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameMr" TEXT NOT NULL
);

INSERT INTO "budget_heads" ("code", "name", "description") VALUES
    ('A215', 'PMU establishment', 'PMU establishment'),
    ('A224', 'IPF (World Bank)', 'IPF (World Bank)'),
    ('A233', 'PforR (state share)', 'PforR (state share)');

INSERT INTO "object_heads" ("code", "name", "nameMr") VALUES
    ('01', 'Salary', 'वेतन'),
    ('06', 'Telephone/Electricity/Water', 'दूरध्वनी, वीज व पाणी शुल्क'),
    ('10', 'Contractual Services', 'कंत्राटी सेवा'),
    ('11', 'Domestic Travel', 'देशांतर्गत प्रवास खर्च'),
    ('13', 'Office Expenses', 'कार्यालयीन खर्च'),
    ('14', 'Rent and Taxes', 'भाडेपट्टी व कर'),
    ('16', 'Publications', 'प्रकाशने'),
    ('17', 'Computer Expenses', 'संगणक खर्च'),
    ('21', 'Supplies and Materials', 'पुरवठा व सामुग्री'),
    ('24', 'Petrol/Oil/Lubricant', 'पेट्रोल, तेल व वंगण'),
    ('26', 'Advertisement and Publicity', 'जाहिरात व प्रसिद्धी'),
    ('27', 'Minor Works', 'लहान बांधकामे'),
    ('28', 'Professional Services', 'व्यावसायिक सेवा'),
    ('31', 'Grant-in-aid (non-salary)', 'सहाय्यक अनुदान (वेतनेतर)');

ALTER TABLE "bills" ADD COLUMN "budgetCode" TEXT;
ALTER TABLE "bills" ADD COLUMN "objectHead" TEXT;

-- AddForeignKey
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameMr" TEXT NOT NULL,
    "prov215" REAL NOT NULL DEFAULT 0,
    "exp215" REAL NOT NULL DEFAULT 0,
    "prov224" REAL NOT NULL DEFAULT 0,
    "exp224" REAL NOT NULL DEFAULT 0,
    "prov233" REAL NOT NULL DEFAULT 0,
    "exp233" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "budgets_code_fkey" FOREIGN KEY ("code") REFERENCES "object_heads" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_budgets" ("id", "code", "name", "nameMr", "prov215", "exp215", "prov224", "exp224", "prov233", "exp233")
SELECT "id", "code", "name", "nameMr", "prov215", "exp215", "prov224", "exp224", "prov233", "exp233" FROM "budgets";
DROP TABLE "budgets";
ALTER TABLE "new_budgets" RENAME TO "budgets";
CREATE UNIQUE INDEX "budgets_code_key" ON "budgets"("code");
PRAGMA foreign_keys=ON;
