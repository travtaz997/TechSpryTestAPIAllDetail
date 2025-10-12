-- +goose Up
ALTER TABLE supplier_items
  ADD COLUMN IF NOT EXISTS item_description text;

-- +goose Down
ALTER TABLE supplier_items
  DROP COLUMN IF EXISTS item_description;
