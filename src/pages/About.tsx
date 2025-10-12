import { Building2, Users, Award, Globe, Target, Zap } from 'lucide-react';

export default function About() {
  return (
    <div className="bg-gray-50">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-6">About TechSpry</h1>
            <p className="text-xl text-blue-100 leading-relaxed">
              Your trusted partner for professional technology solutions. We connect businesses with the tools they need to succeed in an increasingly digital world.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center hover:shadow-lg transition">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">20+ Years Experience</h3>
            <p className="text-gray-600">
              Over two decades of expertise in B2B technology distribution and solutions.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center hover:shadow-lg transition">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">5,000+ Customers</h3>
            <p className="text-gray-600">
              Trusted by businesses of all sizes across multiple industries worldwide.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center hover:shadow-lg transition">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">Global Reach</h3>
            <p className="text-gray-600">
              Serving customers worldwide with fast shipping and reliable support.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-12 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6">
                <Target className="w-8 h-8 text-blue-600" />
                <h2 className="text-3xl font-bold text-gray-800">Our Mission</h2>
              </div>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                To empower businesses with cutting-edge technology solutions that drive innovation, efficiency, and growth. We believe in building lasting partnerships through exceptional service, competitive pricing, and expert guidance.
              </p>
              <p className="text-gray-600 leading-relaxed">
                At TechSpry, we're not just a distributor—we're your technology partner. Our team of experts works tirelessly to understand your unique needs and recommend solutions that align with your business goals.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-12 flex items-center justify-center">
              <Building2 className="w-64 h-64 text-blue-600 opacity-20" />
            </div>
          </div>
        </div>

        <div className="mb-20">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-12">What Sets Us Apart</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Fast Fulfillment</h3>
                  <p className="text-gray-600">
                    Most orders ship same-day with real-time tracking and updates. We understand that time is critical for your business operations.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Premium Brands</h3>
                  <p className="text-gray-600">
                    We partner with the world's leading technology manufacturers to bring you authentic, high-quality products with full warranty coverage.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Expert Support</h3>
                  <p className="text-gray-600">
                    Our knowledgeable team provides technical guidance, product recommendations, and post-purchase support to ensure your success.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Flexible Terms</h3>
                  <p className="text-gray-600">
                    We offer competitive pricing, volume discounts, and net payment terms for qualified businesses to support your cash flow needs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses that trust TechSpry for their technology needs.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/register"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition font-semibold text-lg"
            >
              Create Account
            </a>
            <a
              href="/contact"
              className="bg-blue-700 text-white border-2 border-white px-8 py-3 rounded-lg hover:bg-blue-600 transition font-semibold text-lg"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
