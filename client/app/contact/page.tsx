"use client";

import React, { useState } from "react";
import Link from "next/link";
import Footer from "../_components/Home/Footer";

const ContactPage = () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    setSubmitMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...formData,
          source: "contact_page"
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.message || "Unable to send message.");
      }

      setSubmitStatus("success");
      setSubmitMessage("Message sent successfully! We'll get back to you soon.");
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      setSubmitStatus("error");
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setSubmitMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactMethods = [
    {
      icon: (
        <svg className="w-8 h-8 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: "Email",
      description: "Send us an email and we'll respond within 24 hours",
      contact: "thesocio.blr@gmail.com",
      action: "mailto:thesocio.blr@gmail.com"
    },
    {
      icon: (
        <svg className="w-8 h-8 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      title: "Phone",
      description: "Call us during business hours (9 AM - 6 PM)",
      contact: "+91 88613 30665",
      action: "tel:+918861330665"
    },
    {
      icon: (
        <svg className="w-8 h-8 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: "Visit Us",
      description: "Come visit our team at the campus",
      contact: "Christ University, Bengaluru",
      action: "https://maps.google.com/maps?q=Christ+University+Bengaluru"
    }
  ];

  const teamMembers = [
    {
      name: "Sachin Yadav",
      role: "Co-Founder & Lead Developer",
      email: "thesocio.blr@gmail.com",
      image: "/founder-sachin-yadav.jpg"
    },
    {
      name: "Surya Vamshi",
      role: "Co-Founder & Product Manager",
      email: "thesocio.blr@gmail.com",
      image: "/founder-surya-vamshi.jpg"
    },
    {
      name: "Meeth Shah",
      role: "Co-Founder & Design Lead",
      email: "thesocio.blr@gmail.com",
      image: "/founder-meeth-shah.jpg"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Contact Us
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
          <p className="text-gray-500 mb-6 text-sm sm:text-base">
            Have questions, feedback, or need support? We're here to help make your SOCIO experience amazing.
          </p>
        </div>

        {/* Contact Methods */}
        <div className="mb-16">
          <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-6">
            Get in Touch
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {contactMethods.map((method, index) => (
              <a
                key={index}
                href={method.action}
                className="bg-gray-50 hover:bg-gray-100 transition-all p-6 rounded-lg border border-gray-200 group"
              >
                <div className="flex items-center mb-4">
                  <div className="mr-4">
                    {method.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {method.title}
                  </h3>
                </div>
                <p className="text-gray-600 text-sm mb-3">
                  {method.description}
                </p>
                <p className="text-[#154CB3] font-medium group-hover:underline">
                  {method.contact}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div className="mb-16">
          <div className="bg-gray-50 rounded-lg p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-6">
              Send us a Message
            </h2>
            
            {submitStatus === "success" && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-green-800 font-medium">{submitMessage || "Message sent successfully! We'll get back to you soon."}</p>
                </div>
              </div>
            )}

            {submitStatus === "error" && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-800 font-medium">{submitMessage || "Failed to send message. Please try again."}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                    placeholder="Enter your email address"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                  placeholder="What's this about?"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                  placeholder="Tell us more about your inquiry..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full sm:w-auto px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#154CB3] hover:bg-[#063168] text-white"
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Team Section */}
        <div className="mb-16">
          <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-6">
            Meet Our Team
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {teamMembers.map((member, index) => (
              <div key={index} className="text-center">
                <div className="w-24 h-24 bg-[#154CB3] rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    {member.name.charAt(0)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">
                  {member.name}
                </h3>
                <p className="text-[#154CB3] font-medium mb-2">
                  {member.role}
                </p>
                <a
                  href={`mailto:${member.email}`}
                  className="text-gray-600 hover:text-[#154CB3] text-sm"
                >
                  {member.email}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Quick Links */}
        <div className="bg-[#154CB3] text-white p-6 sm:p-8 rounded-lg">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">
            Looking for Quick Answers?
          </h2>
          <p className="text-blue-100 mb-6">
            Check out our frequently asked questions or get immediate support.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/faq"
              className="bg-white text-[#154CB3] px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-all text-center"
            >
              View FAQ
            </Link>
            <Link
              href="/support"
              className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-all text-center"
            >
              Get Support
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ContactPage;
