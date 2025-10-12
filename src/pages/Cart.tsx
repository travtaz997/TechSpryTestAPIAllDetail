import { Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

export default function Cart() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();
  const { user } = useAuth();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <ShoppingBag className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Your cart is empty</h1>
          <p className="text-gray-600 mb-6">Add some products to get started</p>
          <a
            href="/catalog"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Browse Products
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Shopping Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200">
            {items.map((item) => (
              <div key={item.sku} className="flex gap-4 p-6 border-b border-gray-200 last:border-b-0">
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <div className="text-4xl">📦</div>
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{item.brand}</p>
                  <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center border border-gray-300 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                        className="px-3 py-1 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.sku, parseInt(e.target.value) || 1)}
                        className="w-12 text-center border-x border-gray-300 py-1"
                      />
                      <button
                        onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                        className="px-3 py-1 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.sku)}
                      className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">${item.price.toFixed(2)}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Total: ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <button
              onClick={clearCart}
              className="text-red-600 hover:text-red-700 font-semibold text-sm"
            >
              Clear Cart
            </button>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-24">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>

            <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
            </div>

            <div className="flex justify-between text-lg font-bold text-gray-800 mb-6">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            {user ? (
              <div className="space-y-3">
                <a
                  href="/checkout"
                  className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition text-center font-semibold"
                >
                  Proceed to Checkout
                </a>
                <a
                  href="/account/quotes/new"
                  className="block w-full bg-white border-2 border-blue-600 text-blue-600 py-3 px-6 rounded-lg hover:bg-blue-50 transition text-center font-semibold"
                >
                  Request a Quote
                </a>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Sign in to continue with checkout or request a quote
                </p>
                <a
                  href="/login"
                  className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition text-center font-semibold"
                >
                  Sign In to Continue
                </a>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200">
              <a href="/catalog" className="text-blue-600 hover:text-blue-700 text-sm font-semibold">
                Continue Shopping
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
