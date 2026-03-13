-- 023a: Add 'owner' to user_role enum
-- This must be in its own transaction before any DML uses the new value.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner' BEFORE 'admin';
