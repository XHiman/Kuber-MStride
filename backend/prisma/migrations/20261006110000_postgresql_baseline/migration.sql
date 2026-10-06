-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "sr" INTEGER,
    "vendor" TEXT NOT NULL,
    "invoice" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "budgetCode" TEXT,
    "objectHead" TEXT,
    "transferId" TEXT,
    "program" TEXT,
    "district" TEXT,
    "assignedUserId" TEXT,
    "bucket" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attribute" TEXT,
    "note" TEXT,
    "days" INTEGER,
    "clearedFY" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL DEFAULT 'FY 2026-27',
    "name" TEXT NOT NULL,
    "nameMr" TEXT NOT NULL,
    "prov215" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rel215" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exp215" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prov224" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rel224" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exp224" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prov233" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rel233" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exp233" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_heads" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "budget_heads_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "object_heads" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameMr" TEXT NOT NULL,

    CONSTRAINT "object_heads_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "scopeType" TEXT,
    "purpose" TEXT NOT NULL,
    "objectCode" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fiscalYear" TEXT NOT NULL DEFAULT 'FY 2026-27',
    "budgetCode" TEXT,
    "orderDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "utilized" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "programs" TEXT NOT NULL DEFAULT '[]',
    "districts" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_history" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,

    CONSTRAINT "transfer_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "releaseDate" TIMESTAMP(3),
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_fiscalYear_code_key" ON "budgets"("fiscalYear", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "transfer_history_transferId_changedAt_idx" ON "transfer_history"("transferId", "changedAt");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_budgetCode_fkey" FOREIGN KEY ("budgetCode") REFERENCES "budget_heads"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_objectHead_fkey" FOREIGN KEY ("objectHead") REFERENCES "object_heads"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_code_fkey" FOREIGN KEY ("code") REFERENCES "object_heads"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_budgetCode_fkey" FOREIGN KEY ("budgetCode") REFERENCES "budget_heads"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_history" ADD CONSTRAINT "transfer_history_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
