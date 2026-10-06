ALTER TABLE "users" ADD COLUMN "username" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

DROP TABLE "user_devices";
