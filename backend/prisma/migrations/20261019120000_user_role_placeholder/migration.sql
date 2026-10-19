-- Placeholder role for role-based views (TODO: replace with real role management).
-- 'finance' sees every bill; 'dsu' sees only bills for its own DSU district(s).
ALTER TABLE "users"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'finance';
