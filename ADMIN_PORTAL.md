# TechSpry Admin Portal

## Overview

The TechSpry Admin Portal is a comprehensive administration interface for managing the B2B e-commerce platform. It provides full CRUD functionality for catalog entities, order management, customer management, and system configuration.

## Initial Setup

### 1. Bootstrap Admin User

Before accessing the admin portal, you need to create the initial admin user:

1. Navigate to `/seed-admin` in your browser
2. Click "Seed Admin User" button
3. The system will create an admin user with the following credentials:
   - **Email**: `travis@ts-enterprises.net`
   - **Password**: `mypassword123`

**Important**: This seed operation will only run once. If the `initialized` flag is already set to `true` in the settings table, or if the admin user already exists, the operation will be skipped.

### 2. Login

1. Navigate to `/login`
2. Use the admin credentials above
3. After successful login, navigate to `/admin` to access the admin portal

## Access Control

- **Admin Portal Access**: Only users with `role='admin'` can access the admin portal
- **Route Protection**: All `/admin/*` routes are protected by the `AdminGuard` component
- **Session Validation**: Every request validates the user's session and role

## Features

### Dashboard (`/admin`)

- **KPI Cards**:
  - Published Products count
  - Pending/Confirmed/Shipped Orders
  - Quotes Awaiting Approval
  - Recent Inventory Snapshots (24h)
- **Recent Activity Feed**: Shows last 10 activity log entries
- **Quick Actions**: Fast access to common tasks

### Products Management (`/admin/products`)

- List all products with filtering by:
  - Search (title, SKU)
  - Brand
  - Published status
- View product details including:
  - SKU, title, brand, pricing, stock status
- Edit and delete products
- **Full CRUD**: Create/Edit products (`/admin/products/new` or `/admin/products/{id}`)
  - Basic Information: SKU, title, brand, model, UPC, descriptions
  - Pricing & Inventory: MSRP, MAP price, stock status, lead time
  - Shipping: Weight, country of origin, warranty
  - Published status toggle
  - MAP price validation (must not exceed MSRP)

### Brands Management (`/admin/brands`)

- List all brands
- View brand name, slug, creation date
- Edit and delete brands
- **Full CRUD**: Create/Edit brands (`/admin/brands/new` or `/admin/brands/{id}`)
  - Auto-generated slug from brand name
  - Logo URL field
  - Brand description/blurb

### Orders Management (`/admin/orders`)

- List all orders with status filtering
- View order details:
  - Order ID, PO number, total, status, date
- Status color coding for quick identification
- Order status workflow: Pending → Confirmed → Backordered/Shipped → Cancelled

### Categories Management (`/admin/categories`)

- **Full CRUD**: List, create, edit, and delete categories
- Inline form for quick add/edit
- Parent category selection for hierarchical structure
- Auto-generated slugs from category names
- View parent-child relationships in table

### Customers Management (`/admin/customers`)

- List all customers with search by company/email
- View customer details: company, email, phone
- Toggle payment terms allowance with single click
- View customer groups
- Customer filtering and pagination

### Users Management (`/admin/users`)

- List all users with roles and status
- **Inline role editing**: Change user roles (admin/buyer/viewer) directly in table
- **Toggle active status**: Activate/deactivate users with single click
- View customer linkage status
- Creation date tracking

### Settings Management (`/admin/settings`)

- **General Settings**:
  - Company name
  - Support email
- **Pricing Settings**:
  - Default currency (USD/EUR/GBP)
  - MAP enforcement mode (strict/flexible/none)
- **Checkout Settings**:
  - PO number field toggle
- **Security Settings**:
  - 2FA requirement for admins (placeholder)

### Placeholder Sections

The following sections have placeholder pages ready for implementation:

- **Variants** (`/admin/variants`): Product variant management
- **Bundles** (`/admin/bundles`): Product bundle/kit management
- **Quotes** (`/admin/quotes`): Quote request management
- **Price Rules** (`/admin/price-rules`): Customer group pricing rules
- **Inventory** (`/admin/inventory`): Inventory snapshot viewing and charts
- **Media** (`/admin/media`): File upload and media library
- **Promotions** (`/admin/promotions`): Promotional campaigns
- **Content Blocks** (`/admin/content-blocks`): CMS content blocks
- **Activity Logs** (`/admin/activity-logs`): System audit trail
- **Jobs** (`/admin/jobs`): Background job management

## Database Schema

### New Tables Added

1. **settings**: Global configuration key-value store
   - `key` (text, primary key)
   - `value` (jsonb)
   - `updated_at` (timestamptz)

2. **content_blocks**: CMS content blocks
   - Scheduled start/end dates
   - Active status toggle

3. **jobs**: Background job tracking
   - Job name, status, logs
   - Last run timestamp

### Extended Tables

- **users**: Added `active` column (boolean, default true)
- **price_rules**: Added `priority` column (int, default 0)

## Security

### Row Level Security (RLS)

All tables have RLS enabled with policies enforcing:

- **Public Access**: Anonymous users can view published products, brands, categories
- **Authenticated Access**: Logged-in users can view their own customer data, orders, quotes
- **Admin Access**: Admins have full CRUD access to all tables
- **Activity Logs**: All users can create logs, only admins can view

### Admin Policies

Admin policies check for:
```sql
EXISTS (
  SELECT 1 FROM users
  WHERE users.auth_user_id = auth.uid()
  AND users.role = 'admin'
)
```

### No Recursive Policies

The infinite recursion issue in user policies has been resolved. The policies no longer reference the `users` table within user access checks.

## Environment Variables

All Supabase environment variables are pre-configured:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Development

### File Structure

```
src/
├── components/
│   └── admin/
│       └── AdminLayout.tsx          # Admin sidebar layout
├── pages/
│   └── admin/
│       ├── AdminDashboard.tsx       # Dashboard with KPIs
│       ├── AdminProducts.tsx        # Products management
│       ├── AdminBrands.tsx          # Brands management
│       ├── AdminOrders.tsx          # Orders management
│       ├── AdminPlaceholder.tsx     # Placeholder component
│       └── SeedAdmin.tsx            # Admin user seeding
├── utils/
│   ├── adminGuard.tsx               # Route protection
│   ├── seedAdminUser.ts             # Admin seeding logic
│   └── router.tsx                   # Application routing
└── supabase/
    └── migrations/
        ├── 20251001021601_create_techspry_schema.sql
        ├── 20251001030954_fix_users_table_infinite_recursion.sql
        └── add_admin_portal_extensions.sql
```

### Adding New Admin Pages

1. Create component in `src/pages/admin/`
2. Import in `src/utils/router.tsx`
3. Add route with `AdminGuard` wrapper:
```tsx
{
  path: '/admin/my-page',
  component: () => <AdminGuard><MyPage /></AdminGuard>,
  exact: true
}
```

### Activity Logging

Log administrative actions using:
```typescript
await supabase.from('activity_logs').insert({
  actor: user.id,
  event: 'product.updated',
  meta: { product_id: productId, changes: {...} }
});
```

## Best Practices

### Data Safety

- ✅ All migrations use `IF NOT EXISTS` / `IF EXISTS`
- ✅ Columns added as nullable to avoid data loss
- ✅ No destructive operations (DROP, TRUNCATE)
- ✅ Seed operations are idempotent

### Security

- ✅ Admin-only route protection
- ✅ RLS policies on all tables
- ✅ No recursive policy checks
- ✅ Session validation on every request

### User Experience

- ✅ Loading states for async operations
- ✅ Error handling with user-friendly messages
- ✅ Responsive design for mobile/tablet/desktop
- ✅ Consistent navigation across all admin pages

## Troubleshooting

### Cannot Access Admin Portal

1. Verify user is logged in
2. Check user role in database:
   ```sql
   SELECT email, role FROM users WHERE auth_user_id = '<your-auth-id>';
   ```
3. Ensure role is set to `'admin'`

### Admin User Seed Fails

1. Check if `initialized` flag is already `true`:
   ```sql
   SELECT value FROM settings WHERE key = 'initialized';
   ```
2. If you need to re-seed, update the flag:
   ```sql
   UPDATE settings SET value = 'false' WHERE key = 'initialized';
   ```

### RLS Policy Errors

If you encounter RLS errors:
1. Verify user session is valid
2. Check user role assignment
3. Review policy definitions in migration files

## Future Enhancements

- [ ] Implement remaining placeholder pages
- [ ] Add CSV import/export functionality
- [ ] Build product editor with tabs (Details, Media, Specs, etc.)
- [ ] Implement quote PDF generation
- [ ] Add inventory charts and visualizations
- [ ] Create media library with file uploads
- [ ] Implement background jobs (catalog sync, inventory updates)
- [ ] Add user invitation and password reset flows
- [ ] Build category tree with drag-and-drop
- [ ] Implement 2FA for admin users
