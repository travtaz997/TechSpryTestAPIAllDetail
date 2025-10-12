/*
  Expand products table to persist ScanSource product detail fields
  so customer-facing pages can surface the richer catalog metadata.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS manufacturer_item_number text,
  ADD COLUMN IF NOT EXISTS item_status text,
  ADD COLUMN IF NOT EXISTS plant_material_status_valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS item_image_url text,
  ADD COLUMN IF NOT EXISTS rebox_item boolean,
  ADD COLUMN IF NOT EXISTS b_stock_item boolean,
  ADD COLUMN IF NOT EXISTS catalog_name text,
  ADD COLUMN IF NOT EXISTS business_unit text,
  ADD COLUMN IF NOT EXISTS category_path text,
  ADD COLUMN IF NOT EXISTS product_family text,
  ADD COLUMN IF NOT EXISTS product_family_description text,
  ADD COLUMN IF NOT EXISTS product_family_headline text,
  ADD COLUMN IF NOT EXISTS item_description text,
  ADD COLUMN IF NOT EXISTS product_family_image_url text,
  ADD COLUMN IF NOT EXISTS base_unit_of_measure text,
  ADD COLUMN IF NOT EXISTS general_item_category_group text,
  ADD COLUMN IF NOT EXISTS gross_weight numeric,
  ADD COLUMN IF NOT EXISTS material_group text,
  ADD COLUMN IF NOT EXISTS material_type text,
  ADD COLUMN IF NOT EXISTS battery_indicator text,
  ADD COLUMN IF NOT EXISTS rohs_compliance_indicator text,
  ADD COLUMN IF NOT EXISTS manufacturer_division text,
  ADD COLUMN IF NOT EXISTS commodity_import_code_number text,
  ADD COLUMN IF NOT EXISTS unspsc text,
  ADD COLUMN IF NOT EXISTS delivering_plant text,
  ADD COLUMN IF NOT EXISTS material_freight_group text,
  ADD COLUMN IF NOT EXISTS minimum_order_quantity integer,
  ADD COLUMN IF NOT EXISTS salesperson_intervention_required boolean,
  ADD COLUMN IF NOT EXISTS sell_via_edi boolean,
  ADD COLUMN IF NOT EXISTS sell_via_web text,
  ADD COLUMN IF NOT EXISTS serial_number_profile text,
  ADD COLUMN IF NOT EXISTS packaged_length numeric,
  ADD COLUMN IF NOT EXISTS packaged_width numeric,
  ADD COLUMN IF NOT EXISTS packaged_height numeric,
  ADD COLUMN IF NOT EXISTS date_added timestamptz,
  ADD COLUMN IF NOT EXISTS product_media jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS detail_json jsonb DEFAULT '{}'::jsonb;

-- Backfill a few obvious mappings from legacy columns
UPDATE products
SET
  manufacturer_item_number = COALESCE(NULLIF(manufacturer_item_number, ''), NULLIF(model, '')),
  item_description = COALESCE(NULLIF(item_description, ''), NULLIF(long_desc, ''), NULLIF(short_desc, '')),
  product_family_headline = COALESCE(NULLIF(product_family_headline, ''), NULLIF(short_desc, ''))
WHERE TRUE;

-- Helpful indexes for storefront filters
CREATE INDEX IF NOT EXISTS products_manufacturer_idx ON products (manufacturer);
CREATE INDEX IF NOT EXISTS products_unspsc_idx ON products (unspsc);
CREATE INDEX IF NOT EXISTS products_item_status_idx ON products (item_status);
