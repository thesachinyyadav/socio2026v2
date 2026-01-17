"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Footer from "../_components/Home/Footer";
import { useAuth } from "../../context/AuthContext";

const SupportPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const supportCategories = [
    { id: "all", name: "All Topics", count: 24 },
    { id: "account", name: "Account & Login", count: 6 },
    { id: "events", name: "Events & Registration", count: 8 },
    { id: "technical", name: "Technical Issues", count: 5 },
    { id: "mobile", name: "Mobile App", count: 3 },
    { id: "organizer", name: "Event Organizers", count: 2 }
  ];

  const supportArticles = [
    {
      id: 1,
      category: "account",
      title: "How to create a SOCIO account",
      description: "Step-by-step guide to setting up your student account",
      readTime: "3 min read",
      helpful: 89
    },
    {
      id: 2,
      category: "account",
      title: "Forgot password? Reset it here",
      description: "Quick steps to recover your account access",
      readTime: "2 min read",
      helpful: 156
    },
    {
      id: 3,
      category: "events",
      title: "How to register for events",
      description: "Complete guide to event registration and payment",
      readTime: "4 min read",
      helpful: 234
    },
    {
      id: 4,
      category: "events",
      title: "Managing your event registrations",
      description: "View, modify, or cancel your event bookings",
      readTime: "3 min read",
      helpful: 142
    },
    {
      id: 5,
      category: "events",
      title: "QR code attendance system",
      description: "How the QR attendance tracking works",
      readTime: "2 min read",
      helpful: 98
    },
    {
      id: 6,
      category: "technical",
      title: "App not loading properly",
      description: "Troubleshoot common loading issues",
      readTime: "3 min read",
      helpful: 67
    },
    {
      id: 7,
      category: "technical",
      title: "Notification settings",
      description: "Customize your event notifications",
      readTime: "2 min read",
      helpful: 45
    },
    {
      id: 8,
      category: "organizer",
      title: "How to create and manage events",
      description: "Complete guide for event organizers",
      readTime: "8 min read",
      helpful: 78
    },
    {
      id: 9,
      category: "mobile",
      title: "Download the SOCIO mobile app",
      description: "Get the app for iOS and Android",
      readTime: "1 min read",
      helpful: 234
    }
  ];

  const filteredArticles = supportArticles.filter(article => {
    const matchesCategory = selectedCategory === "all" || article.category === selectedCategory;
    const matchesSearch = searchQuery === "" || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const { isSupport } = useAuth();

  const quickActions = useMemo(() => {
    const actions = [
      {
        title: "Report a Bug",
        description: "Found something that's not working right?",
        action: "Report Issue",
        icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        ),
        bgColor: "bg-red-50",
        iconBg: "bg-red-100",
        textColor: "text-red-600",
        buttonClasses: "bg-red-600 hover:bg-red-700 text-white"
      },
      {
        title: "Request a Feature",
        description: "Have an idea to make SOCIO better?",
        action: "Submit Idea",
        icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        ),
        bgColor: "bg-green-50",
        iconBg: "bg-green-100",
        textColor: "text-green-600",
        buttonClasses: "bg-green-600 hover:bg-green-700 text-white"
      },
      {
        title: "Contact Support",
        description: "Need personal assistance from our team?",
        action: "Get Help",
        icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        ),
        bgColor: "bg-blue-50",
        iconBg: "bg-blue-100",
        textColor: "text-[#154CB3]",
        buttonClasses: "bg-[#154CB3] hover:bg-[#063168] text-white"
      },
      {
        title: "Join the SOCIO Team",
        description: "Explore internship opportunities and grow with us.",
        action: "View Careers",
        icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4 0 2.211 1.79 4 4 4s4-1.789 4-4c0-2.21-1.79-4-4-4zm0-6a3 3 0 013 3v1h2a3 3 0 013 3v1.5a4.5 4.5 0 01-2.41 3.993l-2.43 1.215a2 2 0 00-1.16 1.816V19a2 2 0 11-4 0v-1.476a2 2 0 00-1.16-1.816l-2.43-1.215A4.5 4.5 0 013 10.5V9a3 3 0 013-3h2V4a3 3 0 013-3z" />
        </svg>
        ),
        bgColor: "bg-yellow-50",
        iconBg: "bg-yellow-100",
        textColor: "text-[#936400]",
        buttonClasses: "bg-[#FFCC00] hover:bg-[#ffcc00e6] text-[#063168]",
        href: "/support/careers"
      }
    ];

    if (isSupport) {
      actions.unshift({
        title: "Review Support Inbox",
        description: "View and respond to new student messages.",
        action: "Open Inbox",
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9 6 9-6M3 7l9-4 9 4" />
          </svg>
        ),
        bgColor: "bg-purple-50",
        iconBg: "bg-purple-100",
        textColor: "text-purple-600",
        buttonClasses: "bg-purple-600 hover:bg-purple-700 text-white",
        href: "/support/inbox"
      });
    }

    return actions;
  }, [isSupport]);

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Help & Support
            </h1>
            <Link
              href="/contact"
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
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Contact Us
            </Link>
          </div>
          <p className="text-gray-500 mb-8 text-sm sm:text-base">
            Find answers to common questions or get personalized help from our support team.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <input
              type="text"
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent text-sm sm:text-base"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-16">
          <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-6">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <div key={index} className={`${action.bgColor} p-6 rounded-lg border border-gray-200`}>
                <div className={`w-12 h-12 ${(action.iconBg ?? action.bgColor)} rounded-lg flex items-center justify-center ${action.textColor} mb-4`}>
                  {action.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {action.title}
                </h3>
                <p className="text-gray-600 mb-4 text-sm">
                  {action.description}
                </p>
                {action.href ? (
                  <Link
                    href={action.href}
                    className={`${action.buttonClasses} px-4 py-2 rounded-lg font-medium transition-all text-sm inline-flex items-center gap-2`}
                  >
                    {action.action}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </Link>
                ) : (
                  <button
                    className={`${action.buttonClasses} px-4 py-2 rounded-lg font-medium transition-all text-sm`}
                    type="button"
                  >
                    {action.action}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Support Categories and Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-bold text-[#063168] mb-4">
              Browse by Category
            </h3>
            <div className="space-y-2">
              {supportCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all text-sm ${
                    selectedCategory === category.id
                      ? "bg-[#154CB3] text-white"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{category.name}</span>
                    <span className="text-xs opacity-75">
                      {category.count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Articles */}
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[#063168]">
                Help Articles
              </h3>
              <span className="text-sm text-gray-500">
                {filteredArticles.length} articles found
              </span>
            </div>

            <div className="space-y-4">
              {filteredArticles.map((article) => (
                <div key={article.id} className="bg-gray-50 border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-bold text-gray-800 hover:text-[#154CB3] cursor-pointer">
                      {article.title}
                    </h4>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {article.readTime}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4 text-sm">
                    {article.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <button className="text-[#154CB3] hover:underline font-medium text-sm">
                      Read Article →
                    </button>
                    <div className="flex items-center text-xs text-gray-500">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      {article.helpful} found this helpful
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-700 mb-2">
                  No articles found
                </h3>
                <p className="text-gray-500 mb-4">
                  Try adjusting your search or browse different categories.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                  className="text-[#154CB3] hover:underline font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Still Need Help Section */}
        <div className="mt-16 bg-[#154CB3] text-white p-6 sm:p-8 rounded-lg">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">
              Still Need Help?
            </h2>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Can't find what you're looking for? Our support team is here to help you with any questions or issues.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="bg-white text-[#154CB3] px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-all"
              >
                Contact Support
              </Link>
              <Link
                href="mailto:thesocio.blr@gmail.com"
                className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-all"
              >
                Email Us
              </Link>
              <Link
                href="tel:+918861330665"
                className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-all"
              >
                Call Us
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default SupportPage;
