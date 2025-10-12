/*
  # ScanSource Catalog Importer Schema

  1. Tables
    - supplier_items: Staging area for imported catalog data
    - product_sources: Links products to supplier items

  2. Security
    - RLS enabled
    - Admin-only access policies
*/

CREATE TABLE IF NOT EXISTS supplier_items (
  item_number text PRIMARY KEY,
  mfr_item_number text,
  manufacturer text,
  title text,
  item_description text,
  catalog_name text,
  category_path text,
  product_family text,
  product_family_headline text,
  item_status text,
  item_image_url text,
  product_family_image_url text,
  detail_json jsonb DEFAULT '{}',
  pricing_json jsonb DEFAULT '{}',
  discontinued boolean DEFAULT false,
  last_synced_at timestamptz,
  manufacturer_norm text,
  category_norm text
);

CREATE INDEX IF NOT EXISTS idx_supplier_items_item ON supplier_items(item_number);
CREATE INDEX IF NOT EXISTS idx_supplier_items_mfr ON supplier_items(manufacturer_norm);
CREATE INDEX IF NOT EXISTS idx_supplier_items_cat ON supplier_items(category_norm);

CREATE TABLE IF NOT EXISTS product_sources (
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  supplier text DEFAULT 'scansource',
  item_number text NOT NULL,
  is_primary boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, supplier)
);

CREATE INDEX IF NOT EXISTS idx_product_sources_item ON product_sources(item_number);
CREATE INDEX IF NOT EXISTS idx_product_sources_product ON product_sources(product_id);

ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sources ENABLE ROW LEVEL SECURITY;

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'product_sources'
    AND policyname = 'Admins manage product sources'
  ) THEN
    CREATE POLICY "Admins manage product sources"
      ON product_sources FOR ALL
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