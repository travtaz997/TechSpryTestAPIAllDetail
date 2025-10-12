# ScanSource Catalog Importer

Backend API for importing catalog data from ScanSource into the TechSpry database using a staging + publish workflow.

## Architecture

The importer uses a two-stage approach:

1. **Staging**: Import data into `supplier_items` table
2. **Review & Publish**: Selectively publish items to live `products` table

This prevents accidental overwrites of curated product data.

## Setup

### 1. Environment Variables

Copy the example file and configure:

```bash
cp supabase/functions/scansource-importer/.env.example .env
```

Required variables:
- `SCANSOURCE_BASE` - API base URL
- `SCANSOURCE_API_KEY` - Subscription key (Ocp-Apim-Subscription-Key header)
- `OAUTH_TOKEN_URL` - OAuth2 token endpoint
- `OAUTH_CLIENT_ID` - OAuth2 client ID
- `OAUTH_CLIENT_SECRET` - OAuth2 client secret
- `OAUTH_SCOPE` - OAuth2 scope
- `CUSTOMER_NUMBER` - Your ScanSource customer number
- `REGION` - Region code (default: NA)
- `ADMIN_BEARER_TOKEN` - Secret token for API authentication

### 2. Deploy Edge Function

```bash
supabase functions deploy scansource-importer
```

### 3. Set Environment Variables

```bash
supabase secrets set --env-file .env
```

## API Endpoints

Base URL: `https://{project}.supabase.co/functions/v1/scansource-importer`

All endpoints require `Authorization: Bearer {ADMIN_BEARER_TOKEN}` header.

### POST /import/run

Import catalog data into staging table.

**Request Body:**
```json
{
  "manufacturers": ["HP", "Dell"],
  "categories": ["Laptops", "Monitors"],
  "searchText": "optional search term",
  "maxPages": 5
}
```

**Response:**
```json
{
  "startedAt": "2025-10-01T12:00:00Z",
  "finishedAt": "2025-10-01T12:05:00Z",
  "scanned": 450,
  "added": 200,
  "updated": 250,
  "skipped": 0,
  "errors": []
}
```

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/scansource-importer/import/run \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "manufacturers": ["HP"],
    "categories": ["Laptops"],
    "maxPages": 2
  }'
```

### GET /staging/items

Query staged items before publishing.

**Query Parameters:**
- `manufacturer` - Filter by manufacturer (normalized)
- `category` - Filter by category path (partial match)
- `q` - Search in title or item number
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 50)

**Response:**
```json
{
  "items": [...],
  "total": 450,
  "page": 1,
  "pageSize": 50
}
```

**Example:**
```bash
curl "https://your-project.supabase.co/functions/v1/scansource-importer/staging/items?manufacturer=HP&page=1&pageSize=20" \
  -H "Authorization: Bearer your_admin_token"
```

### GET /import/status

Get status of last import run.

**Example:**
```bash
curl https://your-project.supabase.co/functions/v1/scansource-importer/import/status \
  -H "Authorization: Bearer your_admin_token"
```

### GET /import/diff

Compare staged items against live products.

**Response:**
```json
{
  "new": [
    {
      "item_number": "ABC123",
      "title": "HP Laptop",
      "msrp": 999.99
    }
  ],
  "changed": [
    {
      "item_number": "DEF456",
      "title": "Dell Monitor Updated",
      "current_title": "Dell Monitor",
      "msrp": 299.99,
      "current_msrp": 279.99
    }
  ],
  "unchanged": ["GHI789", "JKL012"]
}
```

**Example:**
```bash
curl https://your-project.supabase.co/functions/v1/scansource-importer/import/diff \
  -H "Authorization: Bearer your_admin_token"
```

### POST /import/publish

Publish selected items to live products table.

**Request Body:**
```json
{
  "item_numbers": ["ABC123", "DEF456"],
  "mapping": {
    "fields_to_copy": ["msrp", "title", "item_status"]
  },
  "upsert": true
}
```

Default `fields_to_copy`: `["msrp", "title", "item_image_url", "item_status"]`

**Response:**
```json
{
  "results": [
    {
      "itemNumber": "ABC123",
      "status": "created",
      "productId": "uuid"
    },
    {
      "itemNumber": "DEF456",
      "status": "updated",
      "productId": "uuid"
    }
  ]
}
```

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/scansource-importer/import/publish \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "item_numbers": ["ABC123", "DEF456"],
    "mapping": {
      "fields_to_copy": ["msrp", "title"]
    }
  }'
```

### POST /import/unpublish

Unpublish products (set published=false).

**Request Body:**
```json
{
  "product_ids": ["uuid1", "uuid2"]
}
```

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/scansource-importer/import/unpublish \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "product_ids": ["product-uuid-1", "product-uuid-2"]
  }'
```

## Workflow

### 1. Import to Staging

```bash
# Import HP and Dell laptops
curl -X POST {base_url}/import/run \
  -H "Authorization: Bearer {token}" \
  -d '{
    "manufacturers": ["HP", "Dell"],
    "categories": ["Laptops"],
    "maxPages": 10
  }'
```

### 2. Review Staged Items

```bash
# Browse staged items
curl "{base_url}/staging/items?manufacturer=HP&pageSize=100" \
  -H "Authorization: Bearer {token}"
```

### 3. Check Differences

```bash
# See what would change
curl {base_url}/import/diff \
  -H "Authorization: Bearer {token}"
```

### 4. Publish Selected Items

```bash
# Publish only specific SKUs
curl -X POST {base_url}/import/publish \
  -H "Authorization: Bearer {token}" \
  -d '{
    "item_numbers": ["SKU001", "SKU002", "SKU003"]
  }'
```

## Data Mapping

### From ScanSource to supplier_items

**product/search fields:**
- `itemNumber` → `item_number` (PK)
- `manufacturerItemNumber` → `mfr_item_number`
- `manufacturer` → `manufacturer`
- `description` → `title` and `description`
- `catalogName` → `catalog_name`
- `categoryPath` → `category_path`
- `productFamily` → `product_family`
- `productFamilyDescription` → `product_family_description`
- `productFamilyHeadline` → `product_family_headline`
- `itemStatus` → `item_status`
- `itemImage` → `item_image_url`
- `productFamilyImage` → `product_family_image_url`

**product/detail:**
- `PlantMaterialStatusValidfrom` → `plant_material_status_valid_from`
- `BusinessUnit` → `business_unit`
- `ReboxItem` → `rebox_item`
- `BStockItem` → `b_stock_item`
- `BaseUnitofMeasure` → `base_unit_of_measure`
- `GeneralItemCategoryGroup` → `general_item_category_group`
- `GrossWeight` → `gross_weight`
- `MaterialGroup` → `material_group`
- `MaterialType` → `material_type`
- `BatteryIndicator` → `battery_indicator`
- `RoHSComplianceIndicator` → `rohs_compliance_indicator`
- `ManufacturerDivision` → `manufacturer_division`
- `CommodityImportCodeNumber` → `commodity_import_code_number`
- `CountryofOrigin` → `country_of_origin`
- `UNSPSC` → `unspsc`
- `DeliveringPlant` → `delivering_plant`
- `MaterialFreightGroup` → `material_freight_group`
- `MinimumOrderQuantity` → `minimum_order_quantity`
- `SalespersonInterventionRequired` → `salesperson_intervention_required`
- `SellviaEDI` → `sell_via_edi`
- `SellviaWeb` → `sell_via_web`
- `SerialNumberProfile` → `serial_number_profile`
- `PackagedLength` → `packaged_length`
- `PackagedWidth` → `packaged_width`
- `PackagedHeight` → `packaged_height`
- `DateAdded` → `date_added`
- `ProductMedia` → `product_media`
- Full payload → `detail_json` (jsonb)

**product/pricing:**
- Response (minus DealInfos) → `pricing_json` (jsonb)
- Includes: msrp, unitPrice, currency, inventory levels, dealer authorization

### From supplier_items to products

Controlled by `fields_to_copy` parameter (default: msrp, title, item_image_url, item_status):

- `pricing_json.msrp` → `products.msrp`
- `title` → `products.title` (only if empty or explicitly allowed)
- `item_status` → `products.stock_status`
- `item_image_url` → `products.images` (if not present)

Curated fields (e.g., long descriptions, custom fields) are **never** overwritten unless explicitly listed.

## Mock Mode

If required environment variables are missing, the API runs in mock mode with deterministic sample data. Useful for testing without ScanSource credentials.

## Database Tables

### supplier_items (staging)
- Stores all imported catalog data
- Safe to re-import (idempotent upserts by item_number)
- Never directly visible to customers

### products (live storefront)
- Only modified via `/import/publish`
- Preserves curated data
- Controls what customers see

### product_sources (linkage)
- Links products to supplier items
- Tracks primary supplier per product
- Enables multi-supplier scenarios

## Security

- All endpoints require `Authorization: Bearer {ADMIN_BEARER_TOKEN}`
- RLS policies restrict access to admin users only
- OAuth2 tokens cached and auto-refreshed
- Subscription key added to all upstream requests
- No secrets in API responses

## Error Handling

- Exponential backoff with jitter on 429/5xx responses
- Max 4 retry attempts
- Detailed error logging in import status
- Per-item error tracking (doesn't fail entire batch)

## Rate Limiting

- Respects ScanSource API rate limits
- Automatic retry with backoff
- Batch pricing calls (max 40 items per request)
- Configurable page size (default 200)

## Query Parameters for Filters

### Manufacturer Filter
Use exact manufacturer names from ScanSource catalog:
```bash
?manufacturers=["HP", "Dell", "Cisco"]
```

### Category Path Filter
Use full category paths (case-sensitive):
```bash
?categories=["Electronics/Laptops", "Electronics/Monitors"]
```

Common category paths:
- `Electronics/Laptops`
- `Electronics/Monitors`
- `Electronics/Desktops`
- `Networking/Switches`
- `Networking/Routers`

Use `/staging/items` to discover available manufacturers and categories in your imported data.
