"use client";

import React, { useState } from "react";
import Link from "next/link";
import Footer from "../_components/Home/Footer";

export default function FAQPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("general");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Icon renderer function
  const renderCategoryIcon = (iconName: string) => {
    const iconClass = "w-5 h-5 mr-3";
    
    switch (iconName) {
      case "organizer":
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zM4.78 15.435A21.95 21.95 0 0110 15c1.845 0 3.64-.226 5.36-.652a.75.75 0 01.518 1.408A20.69 20.69 0 0110 16.5c-1.195 0-2.37-.084-3.5-.248a1.5 1.5 0 01-.72-2.817z" clipRule="evenodd"/>
          </svg>
        );
      default:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
        );
    }
  };

  const faqCategories = [
    { id: "general", name: "General", icon: "❓" },
    { id: "account", name: "Account & Login", icon: "👤" },
    { id: "events", name: "Events", icon: "📅" },
    { id: "registration", name: "Registration", icon: "✅" },
    { id: "technical", name: "Technical", icon: "⚙️" },
    { id: "organizer", name: "Organizers", icon: "organizer" }
  ];

  const faqs = [
    // General FAQs
    {
      id: 1,
      category: "general",
      question: "What is SOCIO?",
      answer: "SOCIO is a comprehensive platform designed to connect students with all campus events, clubs, and activities at Christ University. It serves as a centralized hub where you can discover events, register for activities, and stay updated with campus life."
    },
    {
      id: 2,
      category: "general",
      question: "Is SOCIO free to use?",
      answer: "Yes, SOCIO is completely free for all students. While some events may have registration fees set by organizers, using the platform itself costs nothing."
    },
    {
      id: 3,
      category: "general",
      question: "Which devices can I use SOCIO on?",
      answer: "SOCIO works on all devices with a web browser - phones, tablets, laptops, and desktops. We also have mobile apps available for iOS and Android for the best mobile experience."
    },

    // Account & Login FAQs
    {
      id: 4,
      category: "account",
      question: "How do I create a SOCIO account?",
      answer: "Click 'Sign Up' on the homepage and use your college Google account to register. This ensures only verified students can access the platform and helps maintain security."
    },
    {
      id: 5,
      category: "account",
      question: "I forgot my password. How do I reset it?",
      answer: "Since SOCIO uses Google authentication, you can reset your password through your Google account settings. If you're having trouble logging in, try clearing your browser cache or contact our support team."
    },
    {
      id: 6,
      category: "account",
      question: "Can I change my profile information?",
      answer: "Yes! Go to your profile page to update your name, course details, and other information. Some details like your email are synced with your Google account and cannot be changed directly in SOCIO."
    },

    // Events FAQs
    {
      id: 7,
      category: "events",
      question: "How do I find events I'm interested in?",
      answer: "Use the Discover page to browse all events, or use filters like category, date, or department. You can also search for specific events using the search bar in the navigation."
    },
    {
      id: 8,
      category: "events",
      question: "How do I know if an event is full?",
      answer: "Event pages show current registration status and available spots. If an event is full, you'll see a 'Waitlist' option or 'Event Full' message depending on the organizer's settings."
    },
    {
      id: 9,
      category: "events",
      question: "Can I get refunds for paid events?",
      answer: "Refund policies are set by individual event organizers. Check the event details for specific refund information, or contact the organizers directly through the event page."
    },

    // Registration FAQs
    {
      id: 10,
      category: "registration",
      question: "How do I register for an event?",
      answer: "Click on any event card to view details, then click 'Register Now'. Follow the prompts to complete registration. You'll receive a confirmation email once registered."
    },
    {
      id: 11,
      category: "registration",
      question: "How does QR code attendance work?",
      answer: "After registering, you'll get a unique QR code. Show this code at the event for quick check-in. The QR code is also available in your profile under 'My Events'."
    },
    {
      id: 12,
      category: "registration",
      question: "Can I cancel my event registration?",
      answer: "Yes, you can cancel registrations from your profile's 'My Events' section, subject to the event's cancellation policy. Some events may have deadlines for cancellations."
    },

    // Technical FAQs
    {
      id: 13,
      category: "technical",
      question: "The website is loading slowly. What should I do?",
      answer: "Try refreshing the page, clearing your browser cache, or switching to a different browser. If problems persist, check your internet connection or contact our technical support."
    },
    {
      id: 14,
      category: "technical",
      question: "I'm not receiving notifications. How do I fix this?",
      answer: "Check your notification settings in your profile, ensure you've allowed browser notifications for SOCIO, and verify your email settings. Also check your spam folder for SOCIO emails."
    },
    {
      id: 15,
      category: "technical",
      question: "Can I use SOCIO offline?",
      answer: "SOCIO requires an internet connection for most features. However, your QR codes and basic event information are cached for offline viewing once loaded."
    },

    // Organizer FAQs
    {
      id: 16,
      category: "organizer",
      question: "How can I become an event organizer?",
      answer: "Contact your department coordinator or the SOCIO admin team to request organizer permissions. You'll need to be affiliated with a recognized club, department, or organization."
    },
    {
      id: 17,
      category: "organizer",
      question: "How do I create an event?",
      answer: "Once you have organizer access, click 'Manage Events' in your profile, then 'Create New Event'. Fill in all required details, upload images, and publish your event."
    },
    {
      id: 18,
      category: "organizer",
      question: "Can I track attendance for my events?",
      answer: "Yes! SOCIO provides real-time attendance tracking, registration analytics, and export features for all your events. Access these through your event management dashboard."
    }
  ];

  const filteredFaqs = faqs.filter(faq => 
    selectedCategory === "all" || faq.category === selectedCategory
  );

  const toggleFaq = (id: number) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Frequently Asked Questions
            </h1>
            <Link
              href="/support"
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
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
              Need More Help?
            </Link>
          </div>
          <p className="text-gray-500 mb-6 text-sm sm:text-base">
            Find answers to the most common questions about using SOCIO. Can't find what you're looking for? Contact our support team.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-black text-[#154CB3] mb-1">18</div>
            <div className="text-sm text-gray-600">FAQ Topics</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-black text-green-600 mb-1">95%</div>
            <div className="text-sm text-gray-600">Questions Solved</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-lg font-black text-yellow-600 mb-1">ASAP</div>
            <div className="text-sm text-gray-600">Our team will get back to you at the earliest</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-black text-purple-600 mb-1">24/7</div>
            <div className="text-sm text-gray-600">Self-Service</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-bold text-[#063168] mb-4">
              Categories
            </h3>
            <div className="space-y-2">
              {faqCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all text-sm flex items-center ${
                    selectedCategory === category.id
                      ? "bg-[#154CB3] text-white"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  {renderCategoryIcon(category.icon)}
                  {category.name}
                </button>
              ))}
            </div>

            {/* Contact Card */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-800 mb-2 text-sm">
                Still have questions?
              </h4>
              <p className="text-gray-600 mb-4 text-xs">
                Our support team is here to help you succeed.
              </p>
              <Link
                href="/contact"
                className="bg-[#154CB3] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#063168] transition-all text-xs block text-center"
              >
                Contact Support
              </Link>
            </div>
          </div>

          {/* FAQ Content */}
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[#063168]">
                {faqCategories.find(cat => cat.id === selectedCategory)?.name || "General"} Questions
              </h3>
              <span className="text-sm text-gray-500">
                {filteredFaqs.length} questions
              </span>
            </div>

            <div className="space-y-4">
              {filteredFaqs.map((faq) => (
                <div key={faq.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full px-6 py-4 text-left bg-gray-50 hover:bg-gray-100 transition-all flex justify-between items-center"
                  >
                    <h4 className="font-bold text-gray-800 pr-4">
                      {faq.question}
                    </h4>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        openFaq === faq.id ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {openFaq === faq.id && (
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                      <p className="text-gray-700 leading-relaxed">
                        {faq.answer}
                      </p>
                      <div className="mt-4 flex items-center text-sm text-gray-500">
                        <span>Was this helpful?</span>
                        <button className="ml-3 text-green-600 hover:text-green-700">
                          👍 Yes
                        </button>
                        <button className="ml-2 text-red-600 hover:text-red-700">
                          👎 No
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredFaqs.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-700 mb-2">
                  No FAQs found
                </h3>
                <p className="text-gray-500 mb-4">
                  Try selecting a different category.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Popular Topics */}
        <div className="mt-16 mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-6 text-center">
            Most Popular Topics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-[#154CB3] rounded-full flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd"/>
                </svg>
              </div>
              <h3 className="font-bold text-gray-800 mb-2">Getting Started</h3>
              <p className="text-gray-600 text-sm mb-3">Learn the basics of using SOCIO</p>
              <button 
                onClick={() => setSelectedCategory("general")}
                className="text-[#154CB3] hover:underline text-sm"
              >
                View Questions →
              </button>
            </div>
            
            <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all">
              <div className="text-2xl mb-2">🎫</div>
              <h3 className="font-bold text-gray-800 mb-2">Event Registration</h3>
              <p className="text-gray-600 text-sm mb-3">How to register and manage events</p>
              <button 
                onClick={() => setSelectedCategory("registration")}
                className="text-[#154CB3] hover:underline text-sm"
              >
                View Questions →
              </button>
            </div>
            
            <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all">
              <div className="text-2xl mb-2">⚙️</div>
              <h3 className="font-bold text-gray-800 mb-2">Technical Issues</h3>
              <p className="text-gray-600 text-sm mb-3">Troubleshoot common problems</p>
              <button 
                onClick={() => setSelectedCategory("technical")}
                className="text-[#154CB3] hover:underline text-sm"
              >
                View Questions →
              </button>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-[#154CB3] text-white p-6 sm:p-8 rounded-lg text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">
            Didn't Find Your Answer?
          </h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Our support team is ready to help you with any specific questions or issues you might have.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-white text-[#154CB3] px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-all"
            >
              Contact Support
            </Link>
            <Link
              href="/support"
              className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-all"
            >
              Browse Help Articles
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
