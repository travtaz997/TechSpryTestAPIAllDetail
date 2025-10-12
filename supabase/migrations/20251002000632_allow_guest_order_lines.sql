/*
  # Allow Guest Order Lines

  1. Changes
    - Update order_lines RLS policy to allow guest order lines
    - Anyone (anon or authenticated) can create order lines for any order

  2. Security
    - Order lines can be created by anyone for any order
    - This allows guest checkout to complete
    - Viewing order lines still requires authentication
*/

DROP POLICY IF EXISTS "Buyers can create order lines" ON order_lines;

CREATE POLICY "Allow creating order lines"
  ON order_lines FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
