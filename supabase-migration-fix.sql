-- =============================================================================
-- Fix Migration: Add missing columns and drop FK constraints
-- Run this in Supabase SQL Editor BEFORE re-deploying
-- =============================================================================

-- 1. Products: add extra JSONB column
ALTER TABLE products ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}';

-- 2. Products: change category_id from UUID to text (drop FK)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE products ALTER COLUMN category_id TYPE text USING category_id::text;

-- 3. Transactions: add total_cost, amount_paid columns + change member_id to text
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS total_cost numeric(10,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2);
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_member_id_fkey;
ALTER TABLE transactions ALTER COLUMN member_id TYPE text USING member_id::text;
-- items column: change to text (component uses string format "2x Cafe, 1x Eau")
ALTER TABLE transactions ALTER COLUMN items TYPE text USING items::text;

-- 4. Suggestions: add author column
ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS author text;

-- 5. Batches: add location and unit_cost columns + change product_id to text
ALTER TABLE batches ADD COLUMN IF NOT EXISTS location text DEFAULT 'frigo';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2) DEFAULT 0;
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_product_id_fkey;
ALTER TABLE batches ALTER COLUMN product_id TYPE text USING product_id::text;

-- 6. Procurements: add product_name column + change product_id to text
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE procurements DROP CONSTRAINT IF EXISTS procurements_product_id_fkey;
ALTER TABLE procurements ALTER COLUMN product_id TYPE text USING product_id::text;

-- 7. Credits: change member_id and product_id to text (drop FKs)
ALTER TABLE credits DROP CONSTRAINT IF EXISTS credits_member_id_fkey;
ALTER TABLE credits DROP CONSTRAINT IF EXISTS credits_product_id_fkey;
ALTER TABLE credits ALTER COLUMN member_id TYPE text USING member_id::text;
ALTER TABLE credits ALTER COLUMN product_id TYPE text USING product_id::text;

-- 8. Products: change id to text (so component-generated IDs work)
-- CAREFUL: This is a big change. Only do if products table is empty or freshly migrated.
-- ALTER TABLE products ALTER COLUMN id TYPE text USING id::text;
-- ALTER TABLE products ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- 9. Contact messages table (for the landing page form)
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  club text,
  message text NOT NULL,
  recipients jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Add public SELECT policies for unauthenticated bar access
-- Products
DROP POLICY IF EXISTS "Public can view products" ON products;
CREATE POLICY "Public can view products" ON products FOR SELECT USING (true);

-- Transactions
DROP POLICY IF EXISTS "Public can view transactions" ON transactions;
CREATE POLICY "Public can view transactions" ON transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can insert transactions" ON transactions;
CREATE POLICY "Public can insert transactions" ON transactions FOR INSERT WITH CHECK (true);

-- Members
DROP POLICY IF EXISTS "Public can view members" ON members;
CREATE POLICY "Public can view members" ON members FOR SELECT USING (true);

-- Suggestions
DROP POLICY IF EXISTS "Public can view suggestions" ON suggestions;
CREATE POLICY "Public can view suggestions" ON suggestions FOR SELECT USING (true);

-- Procurements
DROP POLICY IF EXISTS "Public can view procurements" ON procurements;
CREATE POLICY "Public can view procurements" ON procurements FOR SELECT USING (true);

-- Batches
DROP POLICY IF EXISTS "Public can view batches" ON batches;
CREATE POLICY "Public can view batches" ON batches FOR SELECT USING (true);

-- Credits
DROP POLICY IF EXISTS "Public can view credits" ON credits;
CREATE POLICY "Public can view credits" ON credits FOR SELECT USING (true);

-- Categories
DROP POLICY IF EXISTS "Public can view categories" ON categories;
CREATE POLICY "Public can view categories" ON categories FOR SELECT USING (true);

-- Organizations
DROP POLICY IF EXISTS "Public can view organizations" ON organizations;
CREATE POLICY "Public can view organizations" ON organizations FOR SELECT USING (true);
