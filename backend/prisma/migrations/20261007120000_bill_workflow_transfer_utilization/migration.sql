ALTER TABLE "bills"
ADD COLUMN "amountSanctioned" DOUBLE PRECISION,
ADD COLUMN "onHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "holdReason" TEXT;

UPDATE "bills"
SET "onHold" = true, "holdReason" = "note"
WHERE "cat" = 'on_hold';

ALTER TABLE "transfers"
ADD COLUMN "districtFund" TEXT;

CREATE TABLE "transfer_utilizations" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "billId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "utilizedAt" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transfer_utilizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transfer_utilizations_billId_key"
ON "transfer_utilizations"("billId");

CREATE INDEX "transfer_utilizations_transferId_utilizedAt_idx"
ON "transfer_utilizations"("transferId", "utilizedAt");

ALTER TABLE "transfer_utilizations"
ADD CONSTRAINT "transfer_utilizations_transferId_fkey"
FOREIGN KEY ("transferId") REFERENCES "transfers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transfer_utilizations"
ADD CONSTRAINT "transfer_utilizations_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "bills"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "transfer_utilizations" ("id", "transferId", "billId", "amount", "utilizedAt", "remarks")
SELECT 'bill-util-' || b."id", b."transferId", b."id", b."amount", b."updatedAt",
       'Linked cleared bill: ' || b."vendor" || ' / ' || b."invoice"
FROM "bills" b
WHERE b."cat" = 'cleared' AND b."transferId" IS NOT NULL;

INSERT INTO "transfer_utilizations" ("id", "transferId", "amount", "utilizedAt", "remarks")
SELECT 'legacy-util-' || t."id", t."id",
       t."utilized" - COALESCE((
         SELECT SUM(b."amount")
         FROM "bills" b
         WHERE b."transferId" = t."id" AND b."cat" = 'cleared'
       ), 0),
       t."updatedAt",
       'Migrated aggregate utilization; original entry date unavailable'
FROM "transfers" t
WHERE t."utilized" > COALESCE((
  SELECT SUM(b."amount")
  FROM "bills" b
  WHERE b."transferId" = t."id" AND b."cat" = 'cleared'
), 0);

UPDATE "transfers" t
SET "utilized" = COALESCE((
  SELECT SUM(u."amount")
  FROM "transfer_utilizations" u
  WHERE u."transferId" = t."id"
), 0);
