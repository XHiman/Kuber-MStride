ALTER TABLE "bills" ADD COLUMN "transferId" TEXT;

CREATE INDEX "bills_transferId_idx" ON "bills"("transferId");

PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sr" INTEGER,
    "vendor" TEXT NOT NULL,
    "invoice" TEXT NOT NULL,
    "date" DATETIME,
    "amount" REAL NOT NULL,
    "budgetCode" TEXT,
    "objectHead" TEXT,
    "transferId" TEXT,
    "bucket" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attribute" TEXT,
    "note" TEXT,
    "days" INTEGER,
    "clearedFY" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bills_budgetCode_fkey" FOREIGN KEY ("budgetCode") REFERENCES "budget_heads" ("code") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bills_objectHead_fkey" FOREIGN KEY ("objectHead") REFERENCES "object_heads" ("code") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bills_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_bills" SELECT "id", "sr", "vendor", "invoice", "date", "amount", "budgetCode", "objectHead", "transferId", "bucket", "cat", "status", "attribute", "note", "days", "clearedFY", "source", "createdAt", "updatedAt" FROM "bills";
DROP TABLE "bills";
ALTER TABLE "new_bills" RENAME TO "bills";
CREATE INDEX "bills_transferId_idx" ON "bills"("transferId");
PRAGMA foreign_keys=ON;
