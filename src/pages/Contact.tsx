import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle } from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Message Sent!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for contacting us. A member of our team will respond to your inquiry within 24 hours.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({
                name: '',
                email: '',
                company: '',
                phone: '',
                subject: '',
                message: '',
              });
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-blue-100">
            Get in touch with our team. We're here to help.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Phone</h3>
            <p className="text-gray-600 mb-2">Monday - Friday, 8am - 6pm EST</p>
            <a href="tel:+18005551234" className="text-blue-600 hover:text-blue-700 font-semibold">
              1-800-555-1234
            </a>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Email</h3>
            <p className="text-gray-600 mb-2">Response within 24 hours</p>
            <a href="mailto:sales@techspry.com" className="text-blue-600 hover:text-blue-700 font-semibold">
              sales@techspry.com
            </a>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Office</h3>
            <p className="text-gray-600">
              123 Technology Drive<br />
              San Francisco, CA 94105
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Send Us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    id="company"
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your Company"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  id="subject"
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="How can we help you?"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tell us more about your inquiry..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-800">Business Hours</h3>
              </div>
              <div className="space-y-2 text-gray-700">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="font-medium">Monday - Friday</span>
                  <span>8:00 AM - 6:00 PM EST</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="font-medium">Saturday</span>
                  <span>9:00 AM - 3:00 PM EST</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium">Sunday</span>
                  <span>Closed</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg border border-blue-200 p-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Need Immediate Help?</h3>
              <p className="text-gray-700 mb-6">
                For urgent technical support or order issues, please call our hotline:
              </p>
              <a
                href="tel:+18005559999"
                className="block text-center bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                1-800-555-9999
              </a>
              <p className="text-sm text-gray-600 mt-4 text-center">
                Available 24/7 for emergency support
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Sales Inquiries</h3>
              <p className="text-gray-700 mb-4">
                Looking for bulk pricing, custom solutions, or partnership opportunities?
              </p>
              <a
                href="mailto:enterprise@techspry.com"
                className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2"
              >
                <Mail className="w-5 h-5" />
                enterprise@techspry.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
