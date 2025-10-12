/*
  # Allow Guest Orders

  1. Changes
    - Update orders RLS policy to allow guest orders (where created_by is NULL)
    - Guests can create orders without authentication
    - Guest orders will have email stored in notes field

  2. Security
    - Authenticated users can only create orders with their own user ID
    - Guest orders (created_by is NULL) can be created by anyone
    - Viewing orders still requires authentication or admin role
*/

DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;

CREATE POLICY "Allow users and guests to create orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Guest order (no created_by)
    created_by IS NULL
    OR
    -- Authenticated user creating order for themselves
    (created_by IN (
      SELECT id FROM users WHERE users.auth_user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can view own orders" ON orders;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    created_by IN (
      SELECT id FROM users WHERE users.auth_user_id = auth.uid()
    )
    OR
    customer_id IN (
      SELECT customer_id FROM users WHERE users.auth_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );
