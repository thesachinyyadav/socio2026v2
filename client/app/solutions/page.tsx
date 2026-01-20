"use client";

import React from "react";
import Link from "next/link";
import Footer from "../_components/Home/Footer";

const SolutionsPage = () => {
  const solutions = [
    {
      icon: (
        <svg className="w-12 h-12 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      title: "College Fests",
      description: "Manage your annual tech fests, cultural fests, and mega events with ease. Handle multiple events, thousands of registrations, and complex schedules.",
      features: [
        "Multi-day event scheduling",
        "Cross-department coordination",
        "Sponsor management",
        "Live attendance tracking",
        "Real-time analytics dashboard"
      ],
      cta: "Perfect for annual fests",
      color: "blue"
    },
    {
      icon: (
        <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      title: "Department Events",
      description: "Host workshops, seminars, hackathons, and guest lectures. Perfect for department-level activities with focused audience targeting.",
      features: [
        "Department-specific access control",
        "Workshop capacity management",
        "Certificate generation",
        "Feedback collection",
        "Resource material sharing"
      ],
      cta: "Ideal for workshops & seminars",
      color: "green"
    },
    {
      icon: (
        <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Sports Events",
      description: "Organize sports tournaments, inter-college competitions, and athletic meets with bracket management and live scoring.",
      features: [
        "Tournament brackets",
        "Team registration",
        "Match scheduling",
        "Live score updates",
        "Medal tally tracking"
      ],
      cta: "Built for competitions",
      color: "orange"
    },
    {
      icon: (
        <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "Club Activities",
      description: "Manage club memberships, regular meetups, and club-specific events. Keep your community engaged year-round.",
      features: [
        "Member management",
        "Regular meetup scheduling",
        "Attendance history",
        "Club announcements",
        "Activity reports"
      ],
      cta: "Perfect for clubs & cells",
      color: "purple"
    }
  ];

  const caseStudies = [
    {
      college: "Christ University",
      event: "Blossoms 2025",
      stats: {
        events: "50+",
        registrations: "8,000+",
        departments: "12"
      },
      testimonial: "Socio transformed how we manage Blossoms. What used to take weeks now takes hours.",
      author: "Student Council President"
    },
    {
      college: "DAKSH and OPEN DAY",
      event: "Handling 20,000+ Visitors",
      stats: {
        events: "50+",
        registrations: "20,000+",
        departments: "15"
      },
      testimonial: "The QR attendance feature alone saved us countless hours of manual work.",
      author: "Event Coordinator"
    }
  ];

  const benefits = [
    {
      title: "Save Time",
      description: "Automate registrations, attendance, and reporting. Focus on what matters - creating great experiences.",
      stat: "80%",
      statLabel: "reduction in admin work"
    },
    {
      title: "Increase Reach",
      description: "Beautiful event pages and easy sharing help you reach more students across departments.",
      stat: "3x",
      statLabel: "more registrations"
    },
    {
      title: "Better Insights",
      description: "Real-time analytics help you understand your audience and improve future events.",
      stat: "100%",
      statLabel: "data visibility"
    },
    {
      title: "Zero Hassle",
      description: "No technical setup required. Start creating events in minutes, not days.",
      stat: "5 min",
      statLabel: "to get started"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Solutions
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
            Powerful event management tailored for every type of college activity.
          </p>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-[#154CB3] to-[#0d3a8a] rounded-3xl p-8 md:p-12 mb-16 text-white">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              One Platform for All Your College Events
            </h2>
            <p className="text-blue-100 text-lg mb-8">
              From small club meetups to massive annual fests, Socio scales with your needs. 
              Built by students, for students.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/pricing"
                className="bg-white text-[#154CB3] px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-center"
              >
                View Pricing
              </Link>
              <Link
                href="/contact?subject=demo"
                className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors text-center"
              >
                Request Demo
              </Link>
            </div>
          </div>
        </div>

        {/* Solutions Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            Solutions for Every Event Type
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Whether you&apos;re organizing a hackathon, cultural fest, or weekly club meetup, 
            we have the tools you need.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {solutions.map((solution, index) => (
              <div
                key={index}
                className="bg-white border-2 border-gray-100 rounded-2xl p-8 hover:border-[#154CB3]/20 hover:shadow-lg transition-all"
              >
                <div className="mb-4">{solution.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{solution.title}</h3>
                <p className="text-gray-600 mb-4">{solution.description}</p>
                <ul className="space-y-2 mb-6">
                  {solution.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <span className="inline-block bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-full">
                  {solution.cta}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mb-16 bg-gray-50 rounded-3xl p-8 md:p-12">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Why Colleges Choose Socio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-black text-[#154CB3] mb-2">{benefit.stat}</div>
                <div className="text-sm text-gray-500 mb-4">{benefit.statLabel}</div>
                <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Case Studies */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            Trusted by Leading Colleges
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            See how colleges are transforming their event management with Socio.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {caseStudies.map((study, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-2xl p-8"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#154CB3]/10 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{study.college}</h3>
                    <p className="text-sm text-gray-500">{study.event}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#154CB3]">{study.stats.events}</div>
                    <div className="text-xs text-gray-500">Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#154CB3]">{study.stats.registrations}</div>
                    <div className="text-xs text-gray-500">Registrations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#154CB3]">{study.stats.departments}</div>
                    <div className="text-xs text-gray-500">Departments</div>
                  </div>
                </div>
                <blockquote className="border-l-4 border-[#154CB3] pl-4 italic text-gray-600 mb-4">
                  &ldquo;{study.testimonial}&rdquo;
                </blockquote>
                <p className="text-sm text-gray-500">— {study.author}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            How It Works
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Get started in minutes, not days. Here&apos;s how simple it is.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Sign Up", description: "Create your account with your college email" },
              { step: "2", title: "Create Event", description: "Set up your event with our intuitive form" },
              { step: "3", title: "Share & Promote", description: "Share your event page across platforms" },
              { step: "4", title: "Manage & Track", description: "Handle registrations and track attendance" }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-[#154CB3] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-[#154CB3] to-[#0d3a8a] rounded-2xl p-8 md:p-12 text-center text-white mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Simplify Your Event Management?
          </h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of students and organisers who trust Socio for their events.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth"
              className="bg-white text-[#154CB3] px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/pricing"
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SolutionsPage;
