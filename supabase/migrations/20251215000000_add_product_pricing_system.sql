/*
  Add custom pricing fields to products for managing reseller cost and
  customer sale price adjustments.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reseller_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS sale_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_adjustment_type text,
  ADD COLUMN IF NOT EXISTS price_adjustment_value numeric(10,2);

UPDATE products
SET
  reseller_price = COALESCE(reseller_price, NULLIF(map_price, 0), 0),
  sale_price = COALESCE(sale_price, NULLIF(map_price, 0), 0),
  price_adjustment_type = COALESCE(price_adjustment_type, 'fixed'),
  price_adjustment_value = COALESCE(
    price_adjustment_value,
    CASE
      WHEN COALESCE(reseller_price, NULLIF(map_price, 0), 0) = 0 THEN 0
      ELSE COALESCE(sale_price, NULLIF(map_price, 0), 0) - COALESCE(reseller_price, NULLIF(map_price, 0), 0)
    END
  );

UPDATE products
SET map_price = sale_price
WHERE sale_price IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'products'
      AND constraint_name = 'products_price_adjustment_type_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_price_adjustment_type_check
      CHECK (price_adjustment_type IN ('fixed', 'percent'));
  END IF;
END $$;

ALTER TABLE products
  ALTER COLUMN reseller_price SET DEFAULT 0,
  ALTER COLUMN sale_price SET DEFAULT 0,
  ALTER COLUMN price_adjustment_type SET DEFAULT 'fixed',
  ALTER COLUMN price_adjustment_value SET DEFAULT 0;
