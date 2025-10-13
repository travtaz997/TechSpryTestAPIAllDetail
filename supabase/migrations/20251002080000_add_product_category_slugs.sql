-- Add normalized category slug storage for products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_slugs text[] DEFAULT '{}';

WITH normalized AS (
  SELECT
    p.id,
    array_remove(
      array_agg(
        DISTINCT NULLIF(
          regexp_replace(lower(trim(value)), '[^a-z0-9]+', '-', 'g'),
          ''
        )
      ),
      NULL
    ) AS slugs
  FROM products AS p
  LEFT JOIN LATERAL unnest(COALESCE(p.categories, '{}')) AS value ON TRUE
  GROUP BY p.id
)
UPDATE products AS p
SET category_slugs = COALESCE(normalized.slugs, '{}')
FROM normalized
WHERE normalized.id = p.id;

CREATE INDEX IF NOT EXISTS products_category_slugs_idx
  ON products USING GIN (category_slugs);
