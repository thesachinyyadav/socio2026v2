"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getCentreBySlug, Centre } from "@/app/lib/centresData";
import Footer from "@/app/_components/Home/Footer";

const CentreDetailsPage = () => {
  const params = useParams();
  const slug = params.id as string;
  const [centre, setCentre] = useState<Centre | null>(null);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      const foundCentre = getCentreBySlug(slug);
      setCentre(foundCentre || null);
      setLoading(false);
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#154CB3]"></div>
      </div>
    );
  }

  if (!centre) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl font-bold text-[#063168] mb-4">Centre Not Found</h1>
          <p className="text-gray-600 mb-8">The centre you're looking for doesn't exist.</p>
          <Link href="/clubs" className="bg-[#154CB3] text-white px-6 py-3 rounded-lg hover:bg-[#063168] transition">
            Back to Centres
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative w-full h-64 sm:h-80 md:h-96">
        <div className="absolute inset-0">
          {centre.image && !imageError ? (
            <img
              src={centre.image}
              alt={centre.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#063168] to-[#154CB3]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-70"></div>
        </div>
        
        {/* Back Button */}
        <Link 
          href="/clubs" 
          className="absolute top-4 left-4 z-20 flex items-center gap-2 text-white bg-black/30 hover:bg-black/50 px-4 py-2 rounded-full transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back
        </Link>

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 text-white">
          <div className="container mx-auto max-w-7xl">
            <span className="inline-block px-3 py-1 text-xs bg-[#154CB3] text-white rounded-full mb-3">
              {centre.category}
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-2">
              {centre.title}
            </h1>
            {centre.subtitle && (
              <p className="text-lg sm:text-xl text-white/90">
                {centre.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] mb-4">About</h2>
              <p className="text-gray-700 leading-relaxed text-lg">
                {centre.description}
              </p>
            </section>

            {/* Placeholder for future content */}
            <section className="mb-8 bg-[#f5f8fe] rounded-lg p-6">
              <h2 className="text-xl font-bold text-[#063168] mb-4">What We Offer</h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#154CB3] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Workshops and training programs</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#154CB3] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Research opportunities and resources</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#154CB3] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Networking and collaboration events</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#154CB3] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Mentorship and guidance</span>
                </li>
              </ul>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#f5f8fe] rounded-lg p-6 mb-6 sticky top-4">
              <h3 className="text-lg font-semibold text-[#154CB3] mb-4">
                Quick Links
              </h3>
              
              {centre.externalLink && (
                <a
                  href={centre.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#154CB3] text-white py-3 px-4 rounded-lg hover:bg-[#063168] transition duration-200 mb-4"
                >
                  <span>Visit Official Website</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                </a>
              )}
              
              <Link
                href="/clubs"
                className="flex items-center justify-center gap-2 w-full border-2 border-[#154CB3] text-[#154CB3] py-3 px-4 rounded-lg hover:bg-[#154CB3] hover:text-white transition duration-200"
              >
                <span>Browse All Centres</span>
              </Link>
            </div>

            <div className="bg-[#f5f8fe] rounded-lg p-6">
              <h3 className="text-lg font-semibold text-[#154CB3] mb-4">
                Category
              </h3>
              <span className="inline-block px-4 py-2 bg-white text-[#154CB3] border border-[#154CB3] rounded-full text-sm font-medium">
                {centre.category}
              </span>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default CentreDetailsPage;
