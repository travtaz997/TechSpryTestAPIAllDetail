export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4">TechSpry</h3>
            <p className="text-gray-300 text-sm">
              Your trusted partner for enterprise point-of-sale hardware and business technology solutions.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/catalog?category=pos-systems" className="text-gray-300 hover:text-white">POS Systems</a></li>
              <li><a href="/catalog?category=receipt-printers" className="text-gray-300 hover:text-white">Receipt Printers</a></li>
              <li><a href="/catalog?category=barcode-scanners" className="text-gray-300 hover:text-white">Barcode Scanners</a></li>
              <li><a href="/catalog?category=mobile-computers" className="text-gray-300 hover:text-white">Mobile Computers</a></li>
              <li><a href="/brands" className="text-gray-300 hover:text-white">All Brands</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Solutions</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/solutions/retail-pos" className="text-gray-300 hover:text-white">Retail POS</a></li>
              <li><a href="/solutions/qsr" className="text-gray-300 hover:text-white">Quick Service Restaurant</a></li>
              <li><a href="/solutions/warehouse" className="text-gray-300 hover:text-white">Warehouse Management</a></li>
              <li><a href="/solutions/healthcare" className="text-gray-300 hover:text-white">Healthcare</a></li>
              <li><a href="/resources" className="text-gray-300 hover:text-white">Resources</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/about" className="text-gray-300 hover:text-white">About Us</a></li>
              <li><a href="/contact" className="text-gray-300 hover:text-white">Contact</a></li>
              <li><a href="/account/quotes" className="text-gray-300 hover:text-white">Request a Quote</a></li>
              <li><a href="/terms" className="text-gray-300 hover:text-white">Terms of Service</a></li>
              <li><a href="/privacy" className="text-gray-300 hover:text-white">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-300">
          <p>&copy; {currentYear} TechSpry. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <span>Secure Checkout</span>
            <span>•</span>
            <span>Authorized Reseller</span>
            <span>•</span>
            <span>Net Terms Available</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
