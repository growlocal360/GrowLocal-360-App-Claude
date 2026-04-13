-- Add address column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT;

-- Add address column to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS address TEXT;
