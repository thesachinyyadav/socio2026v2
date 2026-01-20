"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import Footer from "../_components/Home/Footer";

const WithSocioPage = () => {
  const services = [
    {
      id: "video-production",
      heading: "BUSINESS VIDEO PRODUCTION",
      description: "End-to-end video production including scripting, shooting, and editing tailored for your business needs.",
      packages: [
        {
          name: "Premium Package",
          details: "30 Videos - Complete Production",
          price: "48,000",
          popular: true
        },
        {
          name: "Standard Package",
          details: "25 Videos - Shooting + Editing",
          price: "30,000",
          popular: false
        }
      ],
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: "personal-branding",
      heading: "PERSONAL BRANDING",
      description: "Build your personal brand with professional video content that showcases your expertise and personality.",
      packages: [
        {
          name: "Premium Package",
          details: "30 Videos - Complete Production",
          price: "43,000",
          popular: true
        },
        {
          name: "Standard Package",
          details: "25 Videos - Shooting + Editing",
          price: "30,000",
          popular: false
        }
      ],
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: "website-development",
      heading: "WEBSITE DEVELOPMENT",
      description: "Professional web solutions to establish your online presence and grow your business.",
      packages: [
        {
          name: "Landing Page",
          details: "Basic responsive landing page",
          price: "10,000",
          pricePrefix: "Starting at",
          popular: false
        }
      ],
      additionalNote: "Full Stack Development: Custom pricing based on your specific requirements and features.",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4 mt-6">
              <Image
                src="/images/withsocio.png"
                alt="With Socio"
                width={60}
                height={60}
                className="rounded-lg"
              />
              <h1 className="text-3xl font-black text-[#154CB3]">
                With Socio
              </h1>
            </div>
            <Link
              href="/solutions"
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
              Back to Solutions
            </Link>
          </div>
          <p className="text-gray-600 text-lg max-w-2xl mt-4">
            Professional creative services to help you build your brand and grow your business.
          </p>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-[#154CB3] to-[#0d3a8a] rounded-3xl p-8 md:p-12 mb-16 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <Image
                src="/images/withsocio.png"
                alt="With Socio"
                width={80}
                height={80}
                className="rounded-xl border-2 border-white/20"
              />
              <div>
                <p className="text-blue-200 text-sm font-medium">Creative Services by</p>
                <h2 className="text-3xl md:text-4xl font-bold">With Socio</h2>
              </div>
            </div>
            <p className="text-blue-100 text-lg mb-8">
              From video production to web development, we provide end-to-end creative solutions 
              to help businesses and individuals establish a strong digital presence.
            </p>
            <a
              href="#services"
              className="inline-flex items-center bg-white text-[#154CB3] px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Explore Services
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>
        </div>

        {/* Services Section */}
        <div id="services" className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
            Our Services
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Choose from our range of professional services designed to elevate your brand.
          </p>

          <div className="space-y-12">
            {services.map((service, index) => (
              <div
                key={service.id}
                className={`rounded-2xl p-8 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white border border-gray-200'}`}
              >
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Service Info */}
                  <div className="lg:w-1/3">
                    <div className="text-[#154CB3] mb-4">
                      {service.icon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-wide">
                      {service.heading}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {service.description}
                    </p>
                    {service.additionalNote && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                        <p className="text-sm text-amber-800">
                          <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {service.additionalNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Packages */}
                  <div className="lg:w-2/3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {service.packages.map((pkg, pkgIndex) => (
                        <div
                          key={pkgIndex}
                          className={`relative rounded-xl p-6 transition-all hover:shadow-lg ${
                            pkg.popular
                              ? 'bg-[#154CB3] text-white'
                              : 'bg-white border-2 border-gray-200'
                          }`}
                        >
                          {pkg.popular && (
                            <div className="absolute -top-3 right-4">
                              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                                RECOMMENDED
                              </span>
                            </div>
                          )}
                          <h4 className={`text-lg font-bold mb-2 ${pkg.popular ? 'text-white' : 'text-gray-900'}`}>
                            {pkg.name}
                          </h4>
                          <p className={`text-sm mb-4 ${pkg.popular ? 'text-blue-100' : 'text-gray-500'}`}>
                            {pkg.details}
                          </p>
                          <div className="flex items-baseline gap-1">
                            {pkg.pricePrefix && (
                              <span className={`text-sm ${pkg.popular ? 'text-blue-200' : 'text-gray-500'}`}>
                                {pkg.pricePrefix}
                              </span>
                            )}
                            <span className={`text-3xl font-black ${pkg.popular ? 'text-white' : 'text-[#154CB3]'}`}>
                              Rs.{pkg.price}
                            </span>
                          </div>
                          <a
                            href={`mailto:withsocio@gmail.com?subject=Inquiry: ${service.heading} - ${pkg.name}`}
                            className={`mt-4 block w-full py-2.5 px-4 rounded-lg text-center font-semibold transition-all ${
                              pkg.popular
                                ? 'bg-white text-[#154CB3] hover:bg-gray-100'
                                : 'bg-[#154CB3] text-white hover:bg-[#0d3a8a]'
                            }`}
                          >
                            Get Started
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="mb-16 bg-gray-50 rounded-3xl p-8 md:p-12">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Why Choose With Socio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Professional Quality",
                description: "Industry-standard equipment and expertise for premium results.",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                )
              },
              {
                title: "Quick Turnaround",
                description: "Fast delivery without compromising on quality.",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
              {
                title: "Affordable Pricing",
                description: "Competitive rates with transparent pricing structure.",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-[#154CB3]/10 text-[#154CB3] rounded-full flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-[#154CB3] to-[#0d3a8a] rounded-2xl p-8 md:p-12 text-white mb-12">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Elevate Your Brand?
            </h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              Let&apos;s create something amazing together
            </p>
            <a
              href="mailto:withsocio@gmail.com?subject=Inquiry from Website"
              className="inline-flex items-center bg-white text-[#154CB3] px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              GET IN TOUCH
            </a>
          </div>

          {/* Contact Info */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-blue-200">Email</span>
                </div>
                <a href="mailto:withsocio@gmail.com" className="text-white hover:underline font-medium">
                  withsocio@gmail.com
                </a>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm text-blue-200">Phone</span>
                </div>
                <a href="tel:+918056178520" className="text-white hover:underline font-medium">
                  +91 8056178520
                </a>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm text-blue-200">Location</span>
                </div>
                <span className="text-white font-medium">Bangalore</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WithSocioPage;
