import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/Layout';
import { Router } from './utils/router';
import { useEffect, useState } from 'react';
import { NavigationProvider } from './contexts/NavigationContext';

function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <CartProvider>
        <NavigationProvider>
          <Layout>
            <Router />
          </Layout>
        </NavigationProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
