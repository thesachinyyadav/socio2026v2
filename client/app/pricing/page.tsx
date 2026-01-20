"use client";

import React, { useState } from "react";
import Link from "next/link";
import Footer from "../_components/Home/Footer";

const PricingPage = () => {
  const [billingCycle, setBillingCycle] = useState<"per-fest" | "annual">("per-fest");

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

  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-4 font-semibold text-gray-900">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900">Free</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900">Basic</th>
                  <th className="text-center py-4 px-4 font-semibold text-[#154CB3]">Pro</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Events per fest", free: "1", basic: "5", pro: "Unlimited", enterprise: "Unlimited" },
                  { feature: "Registrations", free: "50", basic: "500", pro: "2,000", enterprise: "Unlimited" },
                  { feature: "Custom branding", free: "❌", basic: "❌", pro: "✅", enterprise: "✅" },
                  { feature: "Analytics", free: "Basic", basic: "Basic", pro: "Advanced", enterprise: "Custom" },
                  { feature: "Payment gateway", free: "❌", basic: "❌", pro: "✅", enterprise: "✅" },
                  { feature: "API access", free: "❌", basic: "❌", pro: "❌", enterprise: "✅" },
                  { feature: "Support", free: "Community", basic: "Email", pro: "Priority", enterprise: "24/7" },
                  { feature: "On-site support", free: "❌", basic: "❌", pro: "1 day", enterprise: "Unlimited" },
                ].map((row, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-4 px-4 text-gray-700">{row.feature}</td>
                    <td className="text-center py-4 px-4 text-gray-600">{row.free}</td>
                    <td className="text-center py-4 px-4 text-gray-600">{row.basic}</td>
                    <td className="text-center py-4 px-4 text-[#154CB3] font-medium">{row.pro}</td>
                    <td className="text-center py-4 px-4 text-gray-600">{row.enterprise}</td>
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
