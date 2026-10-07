ALTER TABLE "bills"
ADD COLUMN "efileNumber" TEXT;

CREATE TABLE "bill_stage_history" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'tracked',
    CONSTRAINT "bill_stage_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bill_stage_history_billId_enteredAt_idx"
ON "bill_stage_history"("billId", "enteredAt");

ALTER TABLE "bill_stage_history"
ADD CONSTRAINT "bill_stage_history_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "bills"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "bill_stage_history" ("id", "billId", "stage", "enteredAt", "source")
SELECT 'stage-snapshot-' || b."id", b."id", b."bucket", b."updatedAt", 'migration_snapshot'
FROM "bills" b;
