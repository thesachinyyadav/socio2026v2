"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Footer from "../_components/Home/Footer";

const PricingPage = () => {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");
  const [billingCycle, setBillingCycle] = useState<"per-fest" | "annual">("per-fest");
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    organizationType: "",
    phone: "",
    message: ""
  });

  const plans = [
    {
      name: "Free",
      description: "Perfect for trying out Socio",
      price: "₹0",
      period: "forever",
      features: [
        "1 event per month",
        "Up to 50 registrations",
        "Basic event page",
        "Email notifications",
        "QR code attendance",
        "Community support"
      ],
      limitations: [
        "No custom branding",
        "Limited analytics"
      ],
      cta: "Get Started Free",
      ctaLink: "/auth",
      popular: false,
      color: "gray"
    },
    {
      name: "Basic",
      description: "For small departments & clubs",
      price: billingCycle === "per-fest" ? "₹1,499" : "₹14,999",
      period: billingCycle === "per-fest" ? "per fest" : "per year",
      features: [
        "Up to 5 events per fest",
        "Up to 500 registrations",
        "Custom event pages",
        "Email & SMS notifications",
        "QR code attendance",
        "Basic analytics dashboard",
        "Priority email support",
        "Export registrations (CSV)"
      ],
      limitations: [],
      cta: "Start Basic Plan",
      ctaLink: "/contact?plan=basic",
      popular: false,
      color: "blue"
    },
    {
      name: "Pro",
      description: "For college-wide fests",
      price: billingCycle === "per-fest" ? "₹3,999" : "₹39,999",
      period: billingCycle === "per-fest" ? "per fest" : "per year",
      features: [
        "Unlimited events per fest",
        "Up to 2,000 registrations",
        "Custom branding & themes",
        "Advanced analytics & reports",
        "Role-based access control",
        "Timed organiser access",
        "Payment gateway integration",
        "WhatsApp notifications",
        "Dedicated support manager",
        "On-site support (1 day)"
      ],
      limitations: [],
      cta: "Start Pro Plan",
      ctaLink: "/contact?plan=pro",
      popular: true,
      color: "blue"
    },
    {
      name: "Enterprise",
      description: "For universities & large institutions",
      price: "Custom",
      period: "contact us",
      features: [
        "Unlimited everything",
        "White-label solution",
        "Custom domain",
        "API access",
        "SSO integration",
        "Dedicated infrastructure",
        "24/7 priority support",
        "On-site support (unlimited)",
        "Custom feature development",
        "SLA guarantee"
      ],
      limitations: [],
      cta: "Contact Sales",
      ctaLink: "/contact?plan=enterprise",
      popular: false,
      color: "gray"
    }
  ];

  const faqs = [
    {
      question: "How does per-fest pricing work?",
      answer: "You only pay for the fests you organize. A fest can include multiple events over a period of time (typically 2-7 days). Once the fest ends, there are no ongoing charges."
    },
    {
      question: "Can I upgrade my plan mid-fest?",
      answer: "Yes! You can upgrade anytime and only pay the difference. Your existing data and registrations will be preserved."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major payment methods including UPI, credit/debit cards, net banking, and bank transfers for enterprise customers."
    },
    {
      question: "Is there a free trial for paid plans?",
      answer: "Yes, we offer a 7-day free trial for the Basic and Pro plans. No credit card required to start."
    },
    {
      question: "What happens if I exceed my registration limit?",
      answer: "We'll notify you when you're at 80% capacity. You can either upgrade your plan or purchase additional registration packs."
    },
    {
      question: "Do you offer discounts for educational institutions?",
      answer: "Yes! We offer special pricing for verified educational institutions. Contact us with your institution details for a custom quote."
    }
  ];

  useEffect(() => {
    // Check if we're on the client side and if user has already submitted the form
    if (typeof window !== "undefined") {
      const accessGranted = sessionStorage.getItem("pricing_access");
      if (accessGranted === "true") {
        setHasAccess(true);
      }
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Submit to contact form endpoint
      const response = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: `Pricing Inquiry - ${formData.organizationType}`,
          message: `Organization: ${formData.organization}\nType: ${formData.organizationType}\nPhone: ${formData.phone}\n\n${formData.message}`,
          source: "pricing_page"
        })
      });

      if (response.ok) {
        // Grant access and store in sessionStorage
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pricing_access", "true");
        }
        setHasAccess(true);
      } else {
        alert("Failed to submit. Please try again.");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking access
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#154CB3]"></div>
      </div>
    );
  }

  // Show access form if user hasn't filled it yet
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center py-8">
        <main className="container mx-auto px-4 max-w-lg">
          <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#154CB3] to-[#0d3a8a] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Access Pricing
              </h1>
              <p className="text-sm text-gray-600">
                Fill in your details to view our pricing plans
              </p>
            </div>

            {/* Warning Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm text-amber-800 font-medium mb-1">Before you proceed</p>
                  <p className="text-xs text-amber-700">
                    By filling this form, you agree that our team will get in touch with you regarding our services and pricing options.
                  </p>
                </div>
              </div>
            </div>

            {/* Alternative Contact */}
            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-center">
              <p className="text-xs text-gray-600">
                Have questions first? Email us at{" "}
                <a href="mailto:thesocio.blr@gmail.com" className="text-[#154CB3] font-semibold hover:underline">
                  thesocio.blr@gmail.com
                </a>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold text-gray-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent outline-none transition-all"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent outline-none transition-all"
                  placeholder="john@university.edu"
                />
              </div>

              <div>
                <label htmlFor="organization" className="block text-xs font-semibold text-gray-700 mb-1">
                  Organization *
                </label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  required
                  value={formData.organization}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent outline-none transition-all"
                  placeholder="Christ University"
                />
              </div>

              <div>
                <label htmlFor="organizationType" className="block text-xs font-semibold text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  id="organizationType"
                  name="organizationType"
                  required
                  value={formData.organizationType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent bg-white outline-none transition-all"
                >
                  <option value="">Select type...</option>
                  <option value="University/College">University/College</option>
                  <option value="Department/Faculty">Department/Faculty</option>
                  <option value="Student Club/Society">Student Club/Society</option>
                  <option value="Event Management Company">Event Management Company</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-xs font-semibold text-gray-700 mb-1">
                  Brief description (Optional)
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={2}
                  value={formData.message}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Tell us about your event..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#154CB3] to-[#0d3a8a] text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center text-sm mt-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    I Agree, Show Pricing
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                By clicking above, you consent to being contacted by our team
              </p>
            </form>

            {/* Back Link */}
            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
              <Link href="/" className="text-[#154CB3] hover:text-[#0d3a8a] text-sm inline-flex items-center transition-colors">
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show pricing page if user has access
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Pricing
            </h1>
            <Link
              href="/"
              className="flex items-center text-[#063168] hover:underline cursor-pointer text-xs sm:text-base"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
              Back to Home
            </Link>
          </div>
          <p className="text-gray-600 text-lg max-w-2xl">
            Simple, transparent pricing for every college. Start free and scale as you grow.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-gray-100 p-1 rounded-full inline-flex">
            <button
              onClick={() => setBillingCycle("per-fest")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "per-fest"
                  ? "bg-[#154CB3] text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Per Fest
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "annual"
                  ? "bg-[#154CB3] text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Annual <span className="text-green-600 text-xs ml-1">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl p-6 ${
                plan.popular
                  ? "bg-[#154CB3] text-white ring-4 ring-[#154CB3]/20 scale-105"
                  : "bg-white border-2 border-gray-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className={`text-xl font-bold mb-2 ${plan.popular ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm ${plan.popular ? "text-blue-100" : "text-gray-500"}`}>
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className={`text-4xl font-black ${plan.popular ? "text-white" : "text-[#154CB3]"}`}>
                  {plan.price}
                </span>
                <span className={`text-sm ml-2 ${plan.popular ? "text-blue-100" : "text-gray-500"}`}>
                  {plan.period}
                </span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start gap-2">
                    <svg
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.popular ? "text-green-300" : "text-green-500"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={`text-sm ${plan.popular ? "text-blue-50" : "text-gray-600"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
                {plan.limitations.map((limitation, lIndex) => (
                  <li key={lIndex} className="flex items-start gap-2">
                    <svg
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.popular ? "text-blue-300" : "text-gray-400"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className={`text-sm ${plan.popular ? "text-blue-200" : "text-gray-400"}`}>
                      {limitation}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaLink}
                className={`block w-full py-3 px-4 rounded-lg text-center font-semibold transition-all ${
                  plan.popular
                    ? "bg-white text-[#154CB3] hover:bg-gray-100"
                    : plan.name === "Free"
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-[#154CB3] text-white hover:bg-[#0d3a8a]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Feature Comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Compare All Features
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-5 px-6 font-bold text-gray-900 border-b-2 border-gray-200">Feature</th>
                  <th className="text-center py-5 px-4 font-bold text-gray-700 border-b-2 border-gray-200 min-w-[100px]">Free</th>
                  <th className="text-center py-5 px-4 font-bold text-gray-700 border-b-2 border-gray-200 min-w-[100px]">Basic</th>
                  <th className="text-center py-5 px-4 font-bold text-[#154CB3] border-b-2 border-[#154CB3] bg-blue-50 min-w-[100px]">Pro</th>
                  <th className="text-center py-5 px-4 font-bold text-gray-700 border-b-2 border-gray-200 min-w-[100px]">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Events per fest", free: "1", basic: "5", pro: "Unlimited", enterprise: "Unlimited", isText: true },
                  { feature: "Registrations", free: "50", basic: "500", pro: "2,000", enterprise: "Unlimited", isText: true },
                  { feature: "Custom branding", free: false, basic: false, pro: true, enterprise: true, isText: false },
                  { feature: "Analytics", free: "Basic", basic: "Basic", pro: "Advanced", enterprise: "Custom", isText: true },
                  { feature: "Payment gateway", free: false, basic: false, pro: true, enterprise: true, isText: false },
                  { feature: "API access", free: false, basic: false, pro: false, enterprise: true, isText: false },
                  { feature: "WhatsApp notifications", free: false, basic: false, pro: true, enterprise: true, isText: false },
                  { feature: "Role-based access", free: false, basic: false, pro: true, enterprise: true, isText: false },
                  { feature: "Export data (CSV)", free: false, basic: true, pro: true, enterprise: true, isText: false },
                  { feature: "Support", free: "Community", basic: "Email", pro: "Priority", enterprise: "24/7", isText: true },
                  { feature: "On-site support", free: "-", basic: "-", pro: "1 day", enterprise: "Unlimited", isText: true },
                ].map((row, index) => (
                  <tr key={index} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-50 transition-colors`}>
                    <td className="py-4 px-6 text-gray-800 font-medium">{row.feature}</td>
                    <td className="text-center py-4 px-4">
                      {row.isText ? (
                        <span className="text-gray-600 text-sm">{row.free as string}</span>
                      ) : row.free ? (
                        <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.isText ? (
                        <span className="text-gray-600 text-sm">{row.basic as string}</span>
                      ) : row.basic ? (
                        <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </td>
                    <td className="text-center py-4 px-4 bg-blue-50/50">
                      {row.isText ? (
                        <span className="text-[#154CB3] font-semibold text-sm">{row.pro as string}</span>
                      ) : row.pro ? (
                        <svg className="w-5 h-5 text-[#154CB3] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.isText ? (
                        <span className="text-gray-600 text-sm">{row.enterprise as string}</span>
                      ) : row.enterprise ? (
                        <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      openFaq === index ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-[#154CB3] to-[#0d3a8a] rounded-2xl p-8 md:p-12 text-center text-white mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to transform your college events?
          </h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Join 50+ colleges already using Socio to manage their fests and events seamlessly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth"
              className="bg-white text-[#154CB3] px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact?subject=demo"
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PricingPage;

