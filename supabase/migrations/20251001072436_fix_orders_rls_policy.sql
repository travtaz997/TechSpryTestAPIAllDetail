/*
  # Fix Orders RLS Policy for Individual Users

  1. Changes
    - Simplify orders INSERT policy to properly handle individual users without customer accounts
    - Allow authenticated users to create orders where they are the creator
    - Maintain security by ensuring users can only set themselves as created_by

  2. Security
    - Users must be authenticated
    - Users can only create orders with their own user ID in created_by field
    - Customer_id can be null for individual orders
*/

DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;

CREATE POLICY "Authenticated users can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can create order if they are the creator (matches their user record)
    created_by IN (
      SELECT id FROM users WHERE users.auth_user_id = auth.uid()
    )
  );
