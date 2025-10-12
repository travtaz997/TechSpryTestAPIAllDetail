/*
  # Add Admin Portal Extensions

  1. New Tables
    - `settings` - Global settings for admin portal
      - `key` (text, primary key) - Setting identifier
      - `value` (jsonb) - Setting value
      - `updated_at` (timestamptz) - Last update time
    
    - `content_blocks` - CMS blocks for promotions/content
      - `id` (uuid, primary key)
      - `title` (text) - Block title
      - `content` (text) - Block content
      - `start_date` (timestamptz, nullable) - Schedule start
      - `end_date` (timestamptz, nullable) - Schedule end
      - `active` (boolean) - Active status
      - `created_at`, `updated_at` (timestamps)

    - `jobs` - Background job tracking
      - `id` (uuid, primary key)
      - `name` (text) - Job name
      - `status` (text) - Job status
      - `last_run` (timestamptz, nullable) - Last execution time
      - `logs` (text) - Job logs
      - `created_at`, `updated_at` (timestamps)

  2. Table Extensions
    - Add `active` column to users table if not exists
    - Add `priority` column to price_rules if not exists

  3. Security
    - Enable RLS on new tables
    - Admin-only access to settings, content_blocks, and jobs
*/

-- Create settings table for admin portal configuration
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Create content_blocks table for CMS
CREATE TABLE IF NOT EXISTS content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text DEFAULT '',
  start_date timestamptz,
  end_date timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create jobs table for background task tracking
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  last_run timestamptz,
  logs text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add active column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'active'
  ) THEN
    ALTER TABLE users ADD COLUMN active boolean DEFAULT true;
  END IF;
END $$;

-- Add priority column to price_rules if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_rules' AND column_name = 'priority'
  ) THEN
    ALTER TABLE price_rules ADD COLUMN priority int DEFAULT 0;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings (admin only)
CREATE POLICY "Admins can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for content_blocks (admin only)
CREATE POLICY "Admins can view content blocks"
  ON content_blocks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage content blocks"
  ON content_blocks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for jobs (admin only)
CREATE POLICY "Admins can view jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage jobs"
  ON jobs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add updated_at triggers for new tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_settings_updated_at') THEN
    CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_content_blocks_updated_at') THEN
    CREATE TRIGGER update_content_blocks_updated_at BEFORE UPDATE ON content_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_jobs_updated_at') THEN
    CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Initialize default settings
INSERT INTO settings (key, value) VALUES
  ('initialized', 'false'::jsonb),
  ('company_name', '"TechSpry"'::jsonb),
  ('support_email', '"support@techspry.com"'::jsonb),
  ('default_currency', '"USD"'::jsonb),
  ('map_enforcement', '"strict"'::jsonb),
  ('po_enabled', 'true'::jsonb),
  ('require_2fa_admin', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_blocks_active ON content_blocks(active);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_name ON jobs(name);
