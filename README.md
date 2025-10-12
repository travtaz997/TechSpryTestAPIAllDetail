# TechSpry - B2B E-commerce Platform

A production-ready B2B e-commerce site for selling enterprise hardware solutions including POS systems, barcode scanners, mobile computers, and more.

## Features

- Full product catalog with advanced filtering and search
- User authentication with role-based access (admin, buyer, viewer)
- Shopping cart and checkout flow
- Quote request system
- Product detail pages with specifications
- Brand pages and solution categories
- Responsive design with enterprise-grade UI
- Supabase backend with Row Level Security
- MAP (Minimum Advertised Price) compliance

## Tech Stack

- React 18 + TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Supabase for database and authentication
- Lucide React for icons

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase project (already configured in `.env`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. The environment variables are already configured in `.env`:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

3. Seed the database with sample data:
   - Visit `/seed` in your browser
   - Click "Seed Database" button
   - This creates 12 brands and 12 products

4. Start the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Database Schema

### Core Tables

- **brands** - Product manufacturers (Zebra, Honeywell, Epson, etc.)
- **categories** - Product categories with hierarchy support
- **products** - Main product catalog with specs, pricing, and inventory
- **product_variants** - Product variations (colors, sizes, etc.)
- **customers** - Business customer accounts
- **users** - User accounts linked to customers with role-based access
- **orders** - Purchase orders with status tracking
- **order_lines** - Order line items
- **quotes** - Customer quote requests
- **quote_lines** - Quote line items
- **bundles** - Product bundle configurations
- **price_rules** - Special pricing for customer groups
- **inventory_snapshots** - Inventory tracking history
- **activity_logs** - System activity audit trail

### Security

Row Level Security (RLS) is enabled on all tables with the following policies:

- **Public Read**: Anonymous and authenticated users can view published products, brands, and categories
- **Customer Data**: Users can only access their own customer data, quotes, and orders
- **Admin Access**: Admins have full CRUD access to all tables
- **Buyer Permissions**: Buyers can create orders and quotes for their customer account
- **Viewer Permissions**: Viewers have read-only access to their customer data

## User Roles

- **admin** - Full system access, can manage products, brands, customers, and orders
- **buyer** - Can browse catalog, place orders, and request quotes
- **viewer** - Read-only access to customer data and orders

## Pages

### Public Pages
- `/` - Home page with hero, featured products, and solutions
- `/catalog` - Product catalog with filters and search
- `/product/:sku` - Product detail page
- `/brands` - Brand listing
- `/brands/:slug` - Brand detail page
- `/solutions/*` - Solution pages (Retail POS, QSR, Warehouse, Healthcare)

### User Pages
- `/login` - Sign in page
- `/register` - Create account
- `/cart` - Shopping cart
- `/checkout` - Checkout flow
- `/account` - User dashboard
- `/account/orders` - Order history
- `/account/quotes` - Quote requests

### Admin Pages
- `/admin/products` - Product management
- `/admin/brands` - Brand management
- `/admin/orders` - Order management
- `/admin/customers` - Customer management

### Utility Pages
- `/seed` - Database seeding utility

## API Routes (Planned)

These would be implemented as Supabase Edge Functions:

```
GET  /api/catalog - List products with filters
GET  /api/products/:sku - Get product details
GET  /api/brands - List all brands
GET  /api/brands/:slug - Get brand details
GET  /api/search?q= - Search products
POST /api/quotes - Create quote request
GET  /api/quotes/:id - Get quote details
POST /api/orders - Create order
GET  /api/orders/:id - Get order details
```

## Supplier Integration Stubs (Planned)

Future integration endpoints for real-time pricing and inventory:

```
GET  /api/supplier/price-availability?skus=
GET  /api/supplier/inventory?skus=
POST /api/supplier/shipping-quote
POST /api/supplier/submit-order
GET  /api/supplier/order-status?orderRef=
```

## Sample Data

The seed script creates:

### Brands (12 total)
- Zebra - Barcode scanners and mobile computers
- Honeywell - Enterprise scanning and mobility
- Datalogic - Data capture solutions
- Epson - Receipt and label printers
- Star Micronics - POS printers
- Ingenico - Payment terminals
- ID TECH - Payment solutions
- HP - Enterprise POS hardware
- Elo - Commercial touchscreen displays
- Socket Mobile - Mobile data capture
- SATO - Industrial printing
- Seagull Scientific - BarTender software

### Products (12 total)
Sample products include barcode scanners, mobile computers, receipt printers, payment terminals, and touch displays from various manufacturers.

## Development

### Project Structure

```
src/
├── components/       # Reusable components (Header, Footer, Layout)
├── contexts/        # React contexts (Auth, Cart)
├── lib/            # Supabase client and utilities
├── pages/          # Page components
├── utils/          # Helper functions and router
└── main.tsx        # Application entry point
```

### Adding New Products

Products can be added through:
1. The admin interface (when implemented)
2. Direct database insertion via Supabase dashboard
3. Extending the seed script in `src/utils/seedDatabase.ts`

### Customization

- Update brand styling in `tailwind.config.js`
- Modify navigation items in `src/components/Header.tsx`
- Customize footer links in `src/components/Footer.tsx`
- Adjust product categories in database and update references

## Production Deployment

1. Build the project:
```bash
npm run build
```

2. The `dist/` folder contains the production build

3. Deploy to your hosting provider (Vercel, Netlify, etc.)

4. Ensure environment variables are configured:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

## GitHub Export

This project is ready for GitHub export. The repository includes:
- Complete source code
- Database migration scripts (via Supabase)
- README with setup instructions
- TypeScript configuration
- Vite build configuration

## License

Proprietary - TechSpry

## Support

For questions or support, contact your system administrator.
