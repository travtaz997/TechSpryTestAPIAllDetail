/*
  # Add Import Jobs Table
  
  1. New Tables
    - `import_jobs`
      - `id` (uuid, primary key)
      - `status` (text) - pending, running, completed, failed
      - `progress` (jsonb) - stores scan/add/update/skip/error counts
      - `config` (jsonb) - stores import configuration
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_by` (uuid) - reference to auth user
  
  2. Security
    - Enable RLS on `import_jobs` table
    - Add policy for admins to manage import jobs
*/

CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text DEFAULT 'pending',
  progress jsonb DEFAULT '{"scanned": 0, "added": 0, "updated": 0, "skipped": 0, "errors": []}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage import jobs"
  ON import_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );