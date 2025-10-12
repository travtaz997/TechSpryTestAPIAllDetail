/*
  Rebuild supplier_items table to capture full ScanSource product detail
*/

DROP TABLE IF EXISTS supplier_items CASCADE;

CREATE TABLE supplier_items (
  item_number text PRIMARY KEY,
  mfr_item_number text,
  manufacturer text,
  title text,
  item_status text,
  plant_material_status_valid_from timestamptz,
  item_image_url text,
  rebox_item boolean,
  b_stock_item boolean,
  catalog_name text,
  business_unit text,
  category_path text,
  product_family text,
  product_family_description text,
  product_family_headline text,
  description text,
  item_description text,
  product_family_image_url text,
  base_unit_of_measure text,
  general_item_category_group text,
  gross_weight numeric,
  material_group text,
  material_type text,
  battery_indicator text,
  rohs_compliance_indicator text,
  manufacturer_division text,
  commodity_import_code_number text,
  country_of_origin text,
  unspsc text,
  delivering_plant text,
  material_freight_group text,
  minimum_order_quantity integer,
  salesperson_intervention_required boolean,
  sell_via_edi boolean,
  sell_via_web text,
  serial_number_profile text,
  packaged_length numeric,
  packaged_width numeric,
  packaged_height numeric,
  date_added timestamptz,
  product_media jsonb DEFAULT '[]'::jsonb,
  detail_json jsonb DEFAULT '{}'::jsonb,
  pricing_json jsonb DEFAULT '{}'::jsonb,
  stock_available integer,
  stock_updated_at timestamptz,
  discontinued boolean DEFAULT false,
  last_synced_at timestamptz,
  manufacturer_norm text,
  category_norm text
);

CREATE INDEX idx_supplier_items_item ON supplier_items(item_number);
CREATE INDEX idx_supplier_items_mfr ON supplier_items(manufacturer_norm);
CREATE INDEX idx_supplier_items_cat ON supplier_items(category_norm);

ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supplier_items'
      AND policyname = 'Admins manage supplier items'
  ) THEN
    CREATE POLICY "Admins manage supplier items"
      ON supplier_items FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.auth_user_id = auth.uid()
            AND users.role = 'admin'
        )
      );
  END IF;
END $$;
