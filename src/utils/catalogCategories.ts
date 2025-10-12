export interface CatalogCategory {
  slug: string;
  label: string;
  description: string;
  highlights?: string[];
}

export const catalogCategories: CatalogCategory[] = [
  {
    slug: 'barcode-scanners',
    label: 'Barcode Scanners',
    description: 'Handheld, presentation, and rugged scanners for retail, healthcare, and warehouse teams.',
    highlights: ['1D & 2D scanning', 'Corded and cordless options', 'Retail & industrial ready'],
  },
  {
    slug: 'mobile-computers',
    label: 'Mobile Computers',
    description: 'Enterprise mobile computers that keep associates connected on the sales floor or in the field.',
    highlights: ['Android devices', 'Rugged designs', 'Long battery life'],
  },
  {
    slug: 'receipt-printers',
    label: 'Receipt Printers',
    description: 'Fast, reliable receipt printers for countertop POS and mobile checkout experiences.',
    highlights: ['Thermal printers', 'Bluetooth & Ethernet', 'POS integrations'],
  },
  {
    slug: 'label-printers',
    label: 'Label Printers',
    description: 'Industrial and desktop label printers for shipping, asset tracking, and compliance workflows.',
    highlights: ['Thermal transfer', 'RFID capable', 'High-volume ready'],
  },
  {
    slug: 'card-readers-and-payments',
    label: 'Payment Terminals',
    description: 'EMV and NFC-ready payment hardware built for secure, customer-friendly checkout.',
    highlights: ['Contactless payments', 'EMV certified', 'Countertop & mobile'],
  },
  {
    slug: 'touch-displays',
    label: 'Touch Displays',
    description: 'Customer-facing touchscreens and operator displays engineered for demanding POS environments.',
    highlights: ['Edge-to-edge glass', 'Commercial grade', 'POS & kiosk ready'],
  },
];
