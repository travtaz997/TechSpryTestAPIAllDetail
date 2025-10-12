/*
  # Add Address and Shipping Fields to Orders

  1. Changes
    - Add shipping_address jsonb to orders
    - Add billing_address jsonb to orders
    - Add shipping_method text to orders
    - Add shipping_cost numeric to orders
    - Add notes text to orders

  2. Security
    - No RLS changes needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_address jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE orders ADD COLUMN billing_address jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_method text DEFAULT 'standard';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_cost'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_cost numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN notes text DEFAULT '';
  END IF;
END $$;
