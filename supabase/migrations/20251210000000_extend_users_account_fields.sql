-- Extend users profile fields for ecommerce account management
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS account_type text,
  ADD COLUMN IF NOT EXISTS business_profile jsonb,
  ADD COLUMN IF NOT EXISTS net_terms_status text DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS net_terms_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS net_terms_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS net_terms_application jsonb,
  ADD COLUMN IF NOT EXISTS net_terms_internal_notes text;

-- Ensure account type values align with supported options
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_type_check;
ALTER TABLE users
  ADD CONSTRAINT users_account_type_check
  CHECK (
    account_type IS NULL
    OR account_type IN ('business', 'consumer')
  );

-- Ensure net terms status uses the supported lifecycle values
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_net_terms_status_check;
ALTER TABLE users
  ADD CONSTRAINT users_net_terms_status_check
  CHECK (
    net_terms_status IS NULL
    OR net_terms_status IN ('not_requested', 'pending', 'approved', 'declined')
  );

ALTER TABLE users
  ALTER COLUMN net_terms_status SET DEFAULT 'not_requested';
