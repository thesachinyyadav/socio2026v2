"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Footer from "../_components/Home/Footer";

const WithSocioPage = () => {
  const [activeService, setActiveService] = useState<string>("video-production");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const services = [
    {
      id: "video-production",
      title: "Business Video Production",
      tagline: "Tell Your Story Visually",
      description: "Transform your brand narrative with cinematic video content. From concept to final cut, we craft compelling visual stories that captivate your audience and drive engagement.",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      features: [
        "Professional Scriptwriting",
        "4K Cinematography",
        "Color Grading & VFX",
        "Motion Graphics",
        "Licensed Music",
        "Multiple Revisions"
      ],
      packages: [
        {
          name: "Essential",
          videos: "15 Videos",
          description: "Perfect for startups building their content library",
          price: "24,000",
          features: ["HD Quality", "Basic Editing", "2 Revisions", "5-Day Delivery"],
          highlight: false
        },
        {
          name: "Professional",
          videos: "25 Videos",
          description: "Ideal for growing businesses scaling their presence",
          price: "38,000",
          features: ["4K Quality", "Advanced Editing", "4 Revisions", "Priority Support", "Color Grading"],
          highlight: true
        },
        {
          name: "Enterprise",
          videos: "30 Videos",
          description: "Complete production suite for established brands",
          price: "48,000",
          features: ["4K + Drone", "Premium Editing", "Unlimited Revisions", "Dedicated Team", "VFX & Motion Graphics", "Same Week Delivery"],
          highlight: false
        }
      ],
      stats: { clients: "3+", videos: "15+", satisfaction: "100%" }
    },
    {
      id: "personal-branding",
      title: "Personal Branding",
      tagline: "Amplify Your Influence",
      description: "Build an authentic personal brand that resonates. We help thought leaders, entrepreneurs, and professionals establish a powerful digital presence that opens doors.",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      features: [
        "Brand Strategy Session",
        "Content Calendar",
        "Social Media Optimization",
        "Professional Photoshoot",
        "LinkedIn Optimization",
        "Engagement Strategy"
      ],
      packages: [
        {
          name: "Starter",
          videos: "15 Videos",
          description: "Begin your personal branding journey",
          price: "22,000",
          features: ["Brand Audit", "Content Strategy", "15 Videos", "Social Templates"],
          highlight: false
        },
        {
          name: "Growth",
          videos: "25 Videos",
          description: "Accelerate your visibility and reach",
          price: "36,000",
          features: ["Everything in Starter", "25 Videos", "LinkedIn Makeover", "Monthly Analytics", "Engagement Coaching"],
          highlight: true
        },
        {
          name: "Authority",
          videos: "30 Videos",
          description: "Establish yourself as an industry leader",
          price: "43,000",
          features: ["Everything in Growth", "30 Premium Videos", "PR Opportunities", "Speaking Kit", "Podcast Setup", "1-on-1 Coaching"],
          highlight: false
        }
      ],
      stats: { brands: "4+", reach: "10K+", growth: "150%" }
    },
    {
      id: "website-development",
      title: "Website Development",
      tagline: "Your Digital Headquarters",
      description: "Stunning, high-performance websites that convert visitors into customers. Built with cutting-edge technology and designed to make lasting impressions.",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      features: [
        "Custom Design",
        "Mobile Responsive",
        "SEO Optimized",
        "Fast Loading",
        "SSL Security",
        "Analytics Integration"
      ],
      packages: [
        {
          name: "Landing Page",
          videos: "Single Page",
          description: "High-converting landing page for campaigns",
          price: "10,000",
          features: ["Custom Design", "Mobile Responsive", "Contact Form", "Basic SEO", "1 Revision"],
          highlight: false
        },
        {
          name: "Business Website",
          videos: "5-7 Pages",
          description: "Complete website for your business",
          price: "25,000",
          features: ["Custom Multi-page", "CMS Integration", "Blog Setup", "Advanced SEO", "3 Revisions", "30-Day Support"],
          highlight: true
        },
        {
          name: "Full Stack App",
          videos: "Custom",
          description: "Complex web applications tailored to you",
          price: "Custom",
          features: ["Custom Architecture", "Database Design", "API Development", "Admin Dashboard", "Unlimited Revisions", "90-Day Support"],
          highlight: false
        }
      ],
      stats: { websites: "3+", uptime: "99.9%", speed: "<2s" }
    }
  ];

  const currentService = services.find(s => s.id === activeService) || services[0];

  const processSteps = [
    {
      step: "01",
      title: "Discovery",
      description: "We dive deep into your vision, goals, and target audience to create a tailored strategy."
    },
    {
      step: "02",
      title: "Strategy",
      description: "Our team crafts a comprehensive plan aligned with your brand identity and objectives."
    },
    {
      step: "03",
      title: "Creation",
      description: "We bring your vision to life with meticulous attention to detail and creativity."
    },
    {
      step: "04",
      title: "Launch",
      description: "Your content goes live with our support ensuring maximum impact and reach."
    }
  ];

  const testimonials = [
    {
      quote: "With Socio delivered exceptional video quality for my fitness content. Their attention to detail and professionalism made the entire process seamless.",
      author: "Dion Samuel",
      role: "Fitness Creator",
      avatar: "DS"
    },
    {
      quote: "Our Instagram page saw incredible organic growth thanks to With Socio's strategic content approach. They truly understand social media dynamics.",
      author: "Oxytocin",
      role: "Instagram Page",
      avatar: "OX"
    },
    {
      quote: "SOCIO is a domain of WITH SOCIO which takes care of the marketing and creative part of SOCIO. We bridge technology with creativity.",
      author: "Sachin Yadav",
      role: "Founder, SOCIO",
      avatar: "SY"
    }
  ];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-[#154CB3] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to SOCIO</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-xl font-black text-[#154CB3]">WITH</span>
              <span className="text-xl font-black text-[#063168]">SOCIO</span>
            </div>
            <Link
              href="/contact?source=withsocio"
              className="bg-[#154CB3] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#0d3a8a] transition-all hover:shadow-lg"
            >
              Get Quote
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center bg-gradient-to-br from-slate-900 via-[#0d3a8a] to-[#154CB3] overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#FFCC00]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
          </div>

          <div className="container mx-auto px-4 max-w-7xl relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                  <span className="w-2 h-2 bg-[#FFCC00] rounded-full animate-pulse" />
                  <span className="text-white/90 text-sm font-medium">Creative Agency by SOCIO</span>
                </div>
                
                <h1 className="text-4xl md:text-6xl font-black text-white mb-5 leading-tight">
                  We Create
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#FFCC00] to-amber-300">
                    Digital Excellence
                  </span>
                </h1>
                
                <p className="text-lg md:text-xl text-blue-100/90 mb-8 leading-relaxed">
                  Premium video production, personal branding, and web development services that transform your vision into impactful digital experiences.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="#services"
                    className="group inline-flex items-center justify-center gap-3 bg-white text-[#154CB3] px-6 py-3.5 rounded-full font-bold hover:shadow-2xl hover:shadow-white/20 transition-all"
                  >
                    Explore Services
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                  <Link
                    href="/contact?source=withsocio"
                    className="inline-flex items-center justify-center gap-3 bg-transparent border-2 border-white/30 text-white px-6 py-3.5 rounded-full font-bold hover:bg-white/10 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Let&apos;s Talk
                  </Link>
                </div>

                {/* Trust Indicators */}
                <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-black text-white">5+</div>
                    <div className="text-blue-200 text-xs">Projects</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-black text-white">4</div>
                    <div className="text-blue-200 text-xs">Clients</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-black text-white">100%</div>
                    <div className="text-blue-200 text-xs">Satisfaction</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-black text-white">1+</div>
                    <div className="text-blue-200 text-xs">Year Exp</div>
                  </div>
                </div>
              </div>

              {/* Right Visual */}
              <div className={`hidden lg:block transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
                <div className="relative">
                  {/* Main Card */}
                  <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
                    <div className="space-y-6">
                      {/* Service Icons Grid */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/10 rounded-2xl p-4 text-center hover:bg-white/20 transition-all cursor-pointer">
                          <svg className="w-8 h-8 mx-auto text-[#FFCC00] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span className="text-white/80 text-xs">Video</span>
                        </div>
                        <div className="bg-white/10 rounded-2xl p-4 text-center hover:bg-white/20 transition-all cursor-pointer">
                          <svg className="w-8 h-8 mx-auto text-[#FFCC00] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-white/80 text-xs">Branding</span>
                        </div>
                        <div className="bg-white/10 rounded-2xl p-4 text-center hover:bg-white/20 transition-all cursor-pointer">
                          <svg className="w-8 h-8 mx-auto text-[#FFCC00] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="text-white/80 text-xs">Web Dev</span>
                        </div>
                      </div>

                      {/* Testimonial Preview */}
                      <div className="bg-white/5 rounded-2xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFCC00] to-amber-500 flex items-center justify-center text-gray-900 font-bold text-sm flex-shrink-0">
                            RS
                          </div>
                          <div>
                            <p className="text-white/80 text-sm italic">&quot;Exceptional quality and professionalism!&quot;</p>
                            <p className="text-white/50 text-xs mt-1">— Recent Client</p>
                          </div>
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="flex items-center justify-between text-center">
                        <div>
                          <div className="text-[#FFCC00] font-bold">4K</div>
                          <div className="text-white/50 text-xs">Quality</div>
                        </div>
                        <div className="w-px h-8 bg-white/20"></div>
                        <div>
                          <div className="text-[#FFCC00] font-bold">Fast</div>
                          <div className="text-white/50 text-xs">Delivery</div>
                        </div>
                        <div className="w-px h-8 bg-white/20"></div>
                        <div>
                          <div className="text-[#FFCC00] font-bold">24/7</div>
                          <div className="text-white/50 text-xs">Support</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating Elements */}
                  <div className="absolute -top-4 -right-4 bg-[#FFCC00] text-gray-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-bounce" style={{ animationDuration: '2s' }}>
                    New ✨
                  </div>
                  <div className="absolute -bottom-3 -left-3 bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-white text-xs">Available for projects</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
            <span className="text-white/50 text-xs">Scroll to explore</span>
            <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-24 bg-gray-50">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center mb-16">
              <span className="inline-block text-[#154CB3] font-semibold text-sm uppercase tracking-wider mb-3">Our Services</span>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">What We Do Best</h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                Comprehensive creative solutions tailored to elevate your brand and accelerate your growth.
              </p>
            </div>

            {/* Service Tabs */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setActiveService(service.id)}
                  className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-semibold transition-all ${
                    activeService === service.id
                      ? 'bg-[#154CB3] text-white shadow-xl shadow-blue-500/25'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span className={activeService === service.id ? 'text-white' : 'text-[#154CB3]'}>
                    {service.icon}
                  </span>
                  {service.title}
                </button>
              ))}
            </div>

            {/* Active Service Content */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              {/* Service Header */}
              <div className="bg-gradient-to-r from-[#154CB3] to-[#0d3a8a] p-8 md:p-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <span className="text-blue-200 text-sm font-medium uppercase tracking-wider">{currentService.tagline}</span>
                    <h3 className="text-3xl md:text-4xl font-bold text-white mt-2">{currentService.title}</h3>
                    <p className="text-blue-100 mt-4 max-w-xl text-lg">{currentService.description}</p>
                  </div>
                  <div className="flex gap-6">
                    {Object.entries(currentService.stats).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="text-3xl font-black text-white">{value}</div>
                        <div className="text-blue-200 text-sm capitalize">{key}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Features Pills */}
                <div className="flex flex-wrap gap-3 mt-8">
                  {currentService.features.map((feature, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm"
                    >
                      <svg className="w-4 h-4 text-[#FFCC00]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pricing Cards */}
              <div className="p-8 md:p-12">
                <h4 className="text-2xl font-bold text-gray-900 mb-8 text-center">Choose Your Package</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {currentService.packages.map((pkg, index) => (
                    <div
                      key={index}
                      className={`relative rounded-2xl p-8 transition-all hover:-translate-y-2 ${
                        pkg.highlight
                          ? 'bg-gradient-to-br from-[#154CB3] to-[#0d3a8a] text-white shadow-2xl shadow-blue-500/30 scale-105 z-10'
                          : 'bg-gray-50 border border-gray-200 hover:border-[#154CB3] hover:shadow-xl'
                      }`}
                    >
                      {pkg.highlight && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="bg-gradient-to-r from-[#FFCC00] to-amber-400 text-gray-900 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                            MOST POPULAR
                          </span>
                        </div>
                      )}

                      <div className="mb-6">
                        <h5 className={`text-xl font-bold ${pkg.highlight ? 'text-white' : 'text-gray-900'}`}>
                          {pkg.name}
                        </h5>
                        <p className={`text-sm mt-1 ${pkg.highlight ? 'text-blue-100' : 'text-gray-500'}`}>
                          {pkg.videos}
                        </p>
                      </div>

                      <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                          {pkg.price !== "Custom" && (
                            <span className={`text-sm ${pkg.highlight ? 'text-blue-100' : 'text-gray-500'}`}>₹</span>
                          )}
                          <span className={`text-4xl font-black ${pkg.highlight ? 'text-white' : 'text-gray-900'}`}>
                            {pkg.price}
                          </span>
                        </div>
                        <p className={`text-sm mt-2 ${pkg.highlight ? 'text-blue-100' : 'text-gray-500'}`}>
                          {pkg.description}
                        </p>
                      </div>

                      <ul className="space-y-3 mb-8">
                        {pkg.features.map((feature, fIndex) => (
                          <li key={fIndex} className="flex items-center gap-3">
                            <svg
                              className={`w-5 h-5 flex-shrink-0 ${pkg.highlight ? 'text-[#FFCC00]' : 'text-[#154CB3]'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className={`text-sm ${pkg.highlight ? 'text-blue-50' : 'text-gray-600'}`}>
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <Link
                        href={`/contact?service=${currentService.id}&package=${pkg.name.toLowerCase().replace(' ', '-')}&source=withsocio`}
                        className={`block w-full py-4 rounded-xl text-center font-bold transition-all ${
                          pkg.highlight
                            ? 'bg-white text-[#154CB3] hover:bg-gray-100 shadow-lg'
                            : 'bg-[#154CB3] text-white hover:bg-[#0d3a8a]'
                        }`}
                      >
                        Get Started
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center mb-16">
              <span className="inline-block text-[#154CB3] font-semibold text-sm uppercase tracking-wider mb-3">Our Process</span>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">How We Work</h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                A streamlined approach that ensures quality delivery and exceeds expectations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {processSteps.map((process, index) => (
                <div key={index} className="relative">
                  {index < processSteps.length - 1 && (
                    <div className="hidden md:block absolute top-10 left-[60%] w-full h-0.5 bg-gradient-to-r from-[#154CB3] to-transparent" />
                  )}
                  <div className="relative z-10 text-center md:text-left">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#154CB3] to-[#0d3a8a] text-white text-2xl font-black mb-6 shadow-xl shadow-blue-500/25">
                      {process.step}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{process.title}</h3>
                    <p className="text-gray-600">{process.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center mb-16">
              <span className="inline-block text-[#154CB3] font-semibold text-sm uppercase tracking-wider mb-3">Testimonials</span>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">What Our Clients Say</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-gray-100"
                >
                  <svg className="w-10 h-10 text-[#154CB3]/20 mb-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                  <p className="text-gray-700 text-lg mb-6 leading-relaxed">&quot;{testimonial.quote}&quot;</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#154CB3] to-[#0d3a8a] flex items-center justify-center text-white font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{testimonial.author}</div>
                      <div className="text-sm text-gray-500">{testimonial.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-br from-slate-900 via-[#0d3a8a] to-[#154CB3] relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#FFCC00]/10 rounded-full blur-3xl" />
          </div>
          
          <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              Ready to Transform Your Brand?
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Let&apos;s create something extraordinary together. Get in touch and let&apos;s discuss how we can help you achieve your goals.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/contact?source=withsocio"
                className="inline-flex items-center justify-center gap-3 bg-white text-[#154CB3] px-10 py-5 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-white/20 transition-all"
              >
                Start Your Project
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <a
                href="https://wa.me/918056178520"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 bg-green-500 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-green-600 transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp Us
              </a>
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section className="py-16 bg-white border-t border-gray-100">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <a
                href="mailto:withsocio@gmail.com"
                className="group flex items-center gap-5 p-6 rounded-2xl bg-gray-50 hover:bg-[#154CB3] transition-all"
              >
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-lg transition-all">
                  <svg className="w-6 h-6 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500 group-hover:text-blue-100 transition-colors">Email Us</p>
                  <p className="font-bold text-gray-900 group-hover:text-white transition-colors">withsocio@gmail.com</p>
                </div>
              </a>

              <a
                href="tel:+918056178520"
                className="group flex items-center gap-5 p-6 rounded-2xl bg-gray-50 hover:bg-[#154CB3] transition-all"
              >
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-lg transition-all">
                  <svg className="w-6 h-6 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500 group-hover:text-blue-100 transition-colors">Call Us</p>
                  <p className="font-bold text-gray-900 group-hover:text-white transition-colors">+91 8056178520</p>
                </div>
              </a>

              <div className="flex items-center gap-5 p-6 rounded-2xl bg-gray-50">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-bold text-gray-900">Bangalore, India</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default WithSocioPage;
