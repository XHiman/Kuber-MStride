CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "programs" TEXT NOT NULL DEFAULT '[]',
    "districts" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

ALTER TABLE "bills" ADD COLUMN "program" TEXT;
ALTER TABLE "bills" ADD COLUMN "district" TEXT;
ALTER TABLE "bills" ADD COLUMN "assignedUserId" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_devices_deviceId_key" ON "user_devices"("deviceId");
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");
CREATE INDEX "bills_assignedUserId_idx" ON "bills"("assignedUserId");

CREATE TABLE "transfer_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferId" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    CONSTRAINT "transfer_history_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "transfer_history_transferId_changedAt_idx" ON "transfer_history"("transferId", "changedAt");
