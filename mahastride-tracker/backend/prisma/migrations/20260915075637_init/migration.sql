-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sr" INTEGER,
    "vendor" TEXT NOT NULL,
    "invoice" TEXT NOT NULL,
    "date" DATETIME,
    "amount" REAL NOT NULL,
    "bucket" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attribute" TEXT,
    "note" TEXT,
    "days" INTEGER,
    "clearedFY" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameMr" TEXT NOT NULL,
    "prov215" REAL NOT NULL DEFAULT 0,
    "exp215" REAL NOT NULL DEFAULT 0,
    "prov224" REAL NOT NULL DEFAULT 0,
    "exp224" REAL NOT NULL DEFAULT 0,
    "prov233" REAL NOT NULL DEFAULT 0,
    "exp233" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipient" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "objectCode" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "orderDate" DATETIME,
    "status" TEXT NOT NULL,
    "utilized" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "district" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "releaseDate" DATETIME,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_code_key" ON "budgets"("code");
