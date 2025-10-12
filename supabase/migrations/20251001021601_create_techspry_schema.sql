/*
  # TechSpry B2B Ecommerce Database Schema

  1. New Tables
    - `brands` - Product manufacturer/brand information
      - `id` (uuid, primary key)
      - `name` (text, brand name)
      - `slug` (text, unique URL-friendly identifier)
      - `logo_url` (text, brand logo storage path)
      - `blurb` (text, brand description)
      - `links` (jsonb, social/website links)
      - `created_at`, `updated_at` (timestamps)
    
    - `categories` - Product category hierarchy
      - `id` (uuid, primary key)
      - `name` (text, category name)
      - `slug` (text, unique URL-friendly identifier)
      - `parent_id` (uuid, nullable for hierarchy)
      - `created_at`, `updated_at` (timestamps)
    
    - `products` - Main product catalog
      - `id` (uuid, primary key)
      - `sku` (text, unique product identifier)
      - `title` (text, product name)
      - `brand_id` (uuid, foreign key to brands)
      - `model` (text, model number)
      - `upc` (text, universal product code)
      - `short_desc` (text, brief description)
      - `long_desc` (text, detailed description)
      - `images` (jsonb, array of image URLs)
      - `datasheet_url` (text, PDF specification sheet)
      - `categories` (text[], category associations)
      - `tags` (text[], searchable tags)
      - `specs` (jsonb, technical specifications)
      - `msrp` (numeric, manufacturer suggested retail price)
      - `map_price` (numeric, minimum advertised price)
      - `stock_status` (text, in stock/backorder/discontinued)
      - `lead_time_days` (int, delivery timeframe)
      - `weight` (numeric, shipping weight)
      - `dimensions` (jsonb, product dimensions)
      - `warranty` (text, warranty information)
      - `country_of_origin` (text, manufacturing location)
      - `published` (boolean, visibility flag)
      - `created_at`, `updated_at` (timestamps)
    
    - `product_variants` - Product variations (color, size, etc)
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to products)
      - `sku` (text, unique variant identifier)
      - `attrs` (jsonb, variant attributes)
      - `msrp` (numeric)
      - `map_price` (numeric)
      - `active` (boolean)
    
    - `bundles` - Product bundle/kit configurations
      - `id` (uuid, primary key)
      - `title` (text, bundle name)
      - `use_case` (text, solution description)
      - `items` (jsonb, array of {product_id, sku, qty})
      - `created_at`, `updated_at` (timestamps)
    
    - `customers` - Business customer accounts
      - `id` (uuid, primary key)
      - `company` (text, company name)
      - `email` (text, unique contact email)
      - `phone` (text, contact phone)
      - `billing_address` (jsonb, billing address object)
      - `shipping_address` (jsonb, shipping address object)
      - `terms_allowed` (boolean, net payment terms eligibility)
      - `groups` (text[], customer group classifications)
      - `created_at`, `updated_at` (timestamps)
    
    - `users` - User accounts linked to customers
      - `id` (uuid, primary key)
      - `auth_user_id` (uuid, unique reference to auth.users)
      - `customer_id` (uuid, foreign key to customers)
      - `role` (text, admin/buyer/viewer)
      - `email` (text, unique user email)
      - `created_at` (timestamp)
    
    - `orders` - Purchase orders
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `status` (text, order lifecycle status)
      - `currency` (text, default USD)
      - `total` (numeric, order total amount)
      - `po_number` (text, customer purchase order reference)
      - `quote_ref` (text, reference to quote if converted)
      - `placed_at` (timestamptz, order placement time)
      - `created_by` (uuid, user who created order)
      - `created_at`, `updated_at` (timestamps)
    
    - `order_lines` - Order line items
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key to orders)
      - `product_id` (uuid, foreign key to products)
      - `sku` (text, product SKU snapshot)
      - `qty` (int, quantity ordered)
      - `unit_price` (numeric, price per unit)
      - `currency` (text, default USD)
    
    - `quotes` - Customer quote requests
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `status` (text, quote lifecycle status)
      - `pdf_url` (text, generated quote PDF path)
      - `valid_until` (date, quote expiration)
      - `created_by` (uuid, user who requested quote)
      - `created_at`, `updated_at` (timestamps)
    
    - `quote_lines` - Quote line items
      - `id` (uuid, primary key)
      - `quote_id` (uuid, foreign key to quotes)
      - `product_id` (uuid, foreign key to products)
      - `sku` (text, product SKU)
      - `qty` (int, quantity requested)
      - `target_price` (numeric, customer target price)
    
    - `price_rules` - Special pricing for customer groups
      - `id` (uuid, primary key)
      - `group_code` (text, customer group identifier)
      - `percent_off` (numeric, percentage discount)
      - `fixed_price` (numeric, fixed price override)
      - `active` (boolean, rule enabled status)
      - `created_at` (timestamp)
    
    - `inventory_snapshots` - Inventory tracking history
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to products)
      - `warehouse` (text, warehouse location)
      - `on_hand` (int, quantity available)
      - `lead_time_days` (int, replenishment time)
      - `captured_at` (timestamptz, snapshot timestamp)
    
    - `activity_logs` - System activity audit trail
      - `id` (uuid, primary key)
      - `actor` (uuid, user who performed action)
      - `event` (text, event type)
      - `meta` (jsonb, additional event data)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Anonymous users can read published products, brands, and categories
    - Authenticated buyers can read their customer data, quotes, and orders
    - Admins have full access to all tables
    - Viewers can read but not modify customer-related data
*/

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text DEFAULT '',
  blurb text DEFAULT '',
  links jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  title text NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  model text DEFAULT '',
  upc text DEFAULT '',
  short_desc text DEFAULT '',
  long_desc text DEFAULT '',
  images jsonb DEFAULT '[]',
  datasheet_url text DEFAULT '',
  categories text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  specs jsonb DEFAULT '{}',
  msrp numeric(10,2) DEFAULT 0,
  map_price numeric(10,2) DEFAULT 0,
  stock_status text DEFAULT 'In Stock',
  lead_time_days int DEFAULT 0,
  weight numeric(10,2) DEFAULT 0,
  dimensions jsonb DEFAULT '{}',
  warranty text DEFAULT '',
  country_of_origin text DEFAULT '',
  published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  sku text UNIQUE NOT NULL,
  attrs jsonb DEFAULT '{}',
  msrp numeric(10,2) DEFAULT 0,
  map_price numeric(10,2) DEFAULT 0,
  active boolean DEFAULT true
);

-- Create bundles table
CREATE TABLE IF NOT EXISTS bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  use_case text DEFAULT '',
  items jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text DEFAULT '',
  billing_address jsonb DEFAULT '{}',
  shipping_address jsonb DEFAULT '{}',
  terms_allowed boolean DEFAULT false,
  groups text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  role text CHECK (role IN ('admin', 'buyer', 'viewer')) DEFAULT 'viewer',
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status text CHECK (status IN ('Pending', 'Confirmed', 'Backordered', 'Shipped', 'Cancelled')) DEFAULT 'Pending',
  currency text DEFAULT 'USD',
  total numeric(10,2) DEFAULT 0,
  po_number text DEFAULT '',
  quote_ref text DEFAULT '',
  placed_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_lines table
CREATE TABLE IF NOT EXISTS order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  sku text NOT NULL,
  qty int DEFAULT 1,
  unit_price numeric(10,2) DEFAULT 0,
  currency text DEFAULT 'USD'
);

-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status text CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Expired')) DEFAULT 'Draft',
  pdf_url text DEFAULT '',
  valid_until date,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quote_lines table
CREATE TABLE IF NOT EXISTS quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  sku text NOT NULL,
  qty int DEFAULT 1,
  target_price numeric(10,2) DEFAULT 0
);

-- Create price_rules table
CREATE TABLE IF NOT EXISTS price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code text NOT NULL,
  percent_off numeric(5,2) DEFAULT 0,
  fixed_price numeric(10,2) DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create inventory_snapshots table
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  warehouse text NOT NULL,
  on_hand int DEFAULT 0,
  lead_time_days int DEFAULT 0,
  captured_at timestamptz DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid,
  event text NOT NULL,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brands (public read)
CREATE POLICY "Anyone can view brands"
  ON brands FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert brands"
  ON brands FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update brands"
  ON brands FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete brands"
  ON brands FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for categories (public read)
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for products (public read for published)
CREATE POLICY "Anyone can view published products"
  ON products FOR SELECT
  USING (published = true);

CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for product_variants
CREATE POLICY "Anyone can view active variants"
  ON product_variants FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage variants"
  ON product_variants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for bundles
CREATE POLICY "Anyone can view bundles"
  ON bundles FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage bundles"
  ON bundles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for customers
CREATE POLICY "Users can view own customer"
  ON customers FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT customer_id FROM users
      WHERE users.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for users
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM users
      WHERE users.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Buyers can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('buyer', 'admin')
      AND users.customer_id = orders.customer_id
    )
  );

CREATE POLICY "Admins can manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for order_lines
CREATE POLICY "Users can view own order lines"
  ON order_lines FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE orders.customer_id IN (
        SELECT customer_id FROM users
        WHERE users.auth_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Buyers can create order lines"
  ON order_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('buyer', 'admin')
    )
  );

CREATE POLICY "Admins can manage order lines"
  ON order_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for quotes
CREATE POLICY "Users can view own quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM users
      WHERE users.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Buyers can create quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('buyer', 'admin')
      AND users.customer_id = quotes.customer_id
    )
  );

CREATE POLICY "Admins can manage quotes"
  ON quotes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for quote_lines
CREATE POLICY "Users can view own quote lines"
  ON quote_lines FOR SELECT
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE quotes.customer_id IN (
        SELECT customer_id FROM users
        WHERE users.auth_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Buyers can create quote lines"
  ON quote_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('buyer', 'admin')
    )
  );

CREATE POLICY "Admins can manage quote lines"
  ON quote_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for price_rules
CREATE POLICY "Admins can manage price rules"
  ON price_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for inventory_snapshots
CREATE POLICY "Authenticated users can view inventory"
  ON inventory_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage inventory snapshots"
  ON inventory_snapshots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for activity_logs
CREATE POLICY "Admins can view activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can create activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_published ON products(published);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_brands_updated_at') THEN
    CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_categories_updated_at') THEN
    CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_updated_at') THEN
    CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bundles_updated_at') THEN
    CREATE TRIGGER update_bundles_updated_at BEFORE UPDATE ON bundles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_customers_updated_at') THEN
    CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at') THEN
    CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_quotes_updated_at') THEN
    CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;