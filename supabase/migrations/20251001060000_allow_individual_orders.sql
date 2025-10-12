/*
  # Allow Individual Orders Without Customer Account

  1. Changes
    - Update orders INSERT policy to allow orders without customer_id
    - Users can place orders as individuals (customer_id can be null)
    - Users can still only view their own orders

  2. Security
    - Users must be authenticated
    - Users can only create orders for themselves
    - Payment terms still require customer account
*/

DROP POLICY IF EXISTS "Buyers can create orders" ON orders;

CREATE POLICY "Authenticated users can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    (customer_id IS NULL AND created_by IN (
      SELECT id FROM users WHERE users.auth_user_id = auth.uid()
    ))
    OR
    (customer_id IN (
      SELECT customer_id FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('buyer', 'admin')
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
