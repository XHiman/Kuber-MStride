-- Who changed a bill's stage or hold state, and why. Existing rows stay NULL ("not recorded").
ALTER TABLE "bill_stage_history"
ADD COLUMN "changedById" TEXT,
ADD COLUMN "changedByName" TEXT,
ADD COLUMN "note" TEXT;
