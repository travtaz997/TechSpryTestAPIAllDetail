-- Adds a stock_available column to products and backfills from ScanSource staging
-- Safe to re-run.

-- 1) Column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_available integer;

-- 2) Backfill from supplier_items via product_sources
UPDATE products p
SET stock_available = COALESCE(
  (si.pricing_json->>'AvailableQuantity')::int,
  (si.pricing_json->>'availableQuantity')::int,
  (si.pricing_json->>'QuantityAvailable')::int,
  (si.pricing_json->>'qtyAvailable')::int,
  (si.detail_json->>'AvailableQuantity')::int,
  0
)
FROM product_sources ps
JOIN supplier_items si ON si.item_number = ps.item_number
WHERE ps.supplier = 'scansource'
  AND ps.product_id = p.id;

-- 3) Default
ALTER TABLE products
ALTER COLUMN stock_available SET DEFAULT 0;

-- 4) Helpful index
CREATE INDEX IF NOT EXISTS products_stock_available_idx
ON products (stock_available);
