"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import Footer from "../../_components/Home/Footer";

const StoryPage = () => {
  const milestones = [
    {
      year: "2024",
      quarter: "Early",
      title: "The Meeting",
      description: "Sachin Yadav and Surya Vamshi, who had been conducting Python workshops for BBA students, met Meeth Shah. During those sessions, the idea for SOCIO sparked.",
      icon: "meeting"
    },
    {
      year: "2024",
      quarter: "November", 
      title: "Incubation Pitch",
      description: "The trio pitched their refined idea to Christ Incubation Consultation Foundation, where it was officially accepted and incubated.",
      icon: "incubation"
    },
    {
      year: "2025",
      quarter: "March",
      title: "Team Expansion",
      description: "Expanded the team with 4 technical interns from Computer Science department and 7 finance & research interns from Business Management department.",
      icon: "team"
    },
    {
      year: "2025",
      quarter: "July",
      title: "Beta Launch",
      description: "Successfully developed and launched the first beta phase of the SOCIO application and website after extensive development and testing.",
      icon: "launch"
    },
    {
      year: "2025", 
      quarter: "August",
      title: "Official Approval",
      description: "Presented SOCIO to the Chair of Fathers, where the idea was approved and cleared for full-scale testing and implementation.",
      icon: "approval"
    },
    {
      year: "2026", 
      quarter: "January",
      title: "Innowave Presentation",
      description: "Selected to present SOCIO at Innowave 2026, showcasing the platform's capabilities to a wider audience and preparing for campus-wide rollout.",
      icon: "presentation"
    }
  ];

  // Icon renderer function
  const renderIcon = (iconName: string) => {
    const iconClass = "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mr-4 flex-shrink-0";
    
    switch (iconName) {
      case "meeting":
        return (
          <div className={`${iconClass} bg-purple-500`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
            </svg>
          </div>
        );
      case "incubation":
        return (
          <div className={`${iconClass} bg-indigo-500`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 2h2v4H7V6zm8 0h-2v4h2V6z" clipRule="evenodd"/>
            </svg>
          </div>
        );
      case "team":
        return (
          <div className={`${iconClass} bg-[#154CB3]`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
            </svg>
          </div>
        );
      case "launch":
        return (
          <div className={`${iconClass} bg-green-500`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </div>
        );
      case "approval":
        return (
          <div className={`${iconClass} bg-emerald-500`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
        );
      case "presentation":
        return (
          <div className={`${iconClass} bg-[#FFCC00]`}>
            <svg className="w-5 h-5 text-[#063168]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className={`${iconClass} bg-[#154CB3]`}>
            <span>{iconName.charAt(0).toUpperCase()}</span>
          </div>
        );
    }
  };

  const challenges = [
    {
      problem: "Information Scattered",
      description: "Students missed events because announcements were spread across WhatsApp groups, social media, and notice boards.",
      solution: "Created a centralized platform where all events are discoverable in one place."
    },
    {
      problem: "Manual Attendance",
      description: "Event organizers spent hours manually tracking attendance with paper lists and signatures.",
      solution: "Implemented QR code-based attendance system for instant, accurate tracking."
    },
    {
      problem: "Limited Reach",
      description: "Great events had low attendance because word didn't spread effectively across the campus.",
      solution: "Built notification systems and personalized discovery to help students find relevant events."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Our Story
            </h1>
            <Link
              href="/about"
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
              Back to About
            </Link>
          </div>
          <p className="text-gray-500 mb-6 text-sm sm:text-base">
            From a simple competition idea to a platform transforming campus life - here's how SOCIO came to be.
          </p>
        </div>

        {/* Hero Section */}
        <div className="relative mb-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#063168] to-[#154CB3] text-white">
          <div className="px-8 py-14 sm:px-14 sm:py-20 max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#FFCC00] mb-4">
              How it all started
            </p>
            <h2 className="text-3xl sm:text-5xl font-black mb-6 leading-tight">
              From a Classroom Idea to{" "}
              <span className="text-[#FFCC00]">Campus Innovation</span>
            </h2>
            <p className="text-base sm:text-lg text-blue-100 mb-3 leading-relaxed">
              SOCIO&apos;s story began in a BBA classroom. Sachin Yadav and Surya Vamshi were conducting
              Python workshops for students when they met Meeth Shah -- and together, an idea was born.
            </p>
            <p className="text-sm sm:text-base text-blue-200/80">
              What started as casual conversations about campus problems has grown into a platform
              that&apos;s transforming how students connect with their community.
            </p>
          </div>
        </div>

        {/* The Problem Section */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">The Challenge</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#063168] mb-2">
              The Problem We Saw
            </h2>
            <div className="mt-3 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {challenges.map((challenge, index) => (
              <div key={index} className="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl">
                <h3 className="text-lg font-bold text-red-800 mb-3">
                  {challenge.problem}
                </h3>
                <p className="text-red-700 mb-4 text-sm">
                  {challenge.description}
                </p>
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
                  <p className="text-green-800 text-sm font-medium">
                    Our Solution: {challenge.solution}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Founder Story */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">Origin</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#063168] mb-2">
              How It All Started
            </h2>
            <div className="mt-3 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="relative w-full max-w-lg mx-auto overflow-hidden rounded-lg shadow-lg mb-6">
                <img
                  src="/teaching.png"
                  alt="Sachin Yadav teaching Python to BBA students"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <p className="text-white text-center font-medium">
                    Sachin Yadav teaching Python to BBA students - where it all began
                  </p>
                </div>
              </div>
              
              <div className="relative w-full max-w-lg mx-auto overflow-hidden rounded-lg shadow-lg">
                <img
                  src="/sachinsuryameeth.jpg"
                  alt="SOCIO Founders - Sachin Yadav, Surya Vamshi, and Meeth Shah"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <p className="text-white text-center font-medium">
                    The founding team: Sachin Yadav, Surya Vamshi, and Meeth Shah
                  </p>
                </div>
              </div>
            </div>
            <div>
              <div className="space-y-4">
                <div className="bg-yellow-50 border-l-4 border-[#FFCC00] p-6 rounded-xl">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    The Classroom Connection
                  </h3>
                  <p className="text-gray-700 text-sm">
                    &quot;We were conducting Python workshops for BBA students when we noticed them
                    struggling to find and connect with campus events. That&apos;s when we met Meeth Shah,
                    and the conversations began.&quot;
                  </p>
                  <p className="text-[#154CB3] font-medium text-sm mt-2">
                    — Sachin Yadav & Surya Vamshi
                  </p>
                </div>
                
                <div className="bg-blue-50 border-l-4 border-[#154CB3] p-6 rounded-xl">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    The Spark of Innovation
                  </h3>
                  <p className="text-gray-700 text-sm">
                    "What started as casual discussions about campus life challenges soon evolved into a concrete idea. 
                    We realized we could solve a real problem that every student faces - staying connected with campus activities."
                  </p>
                  <p className="text-[#154CB3] font-medium text-sm mt-2">
                    — The SOCIO Team
                  </p>
                </div>

                <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-xl">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    From Idea to Incubation
                  </h3>
                  <p className="text-gray-700 text-sm">
                    "By November 2024, we had refined our concept enough to pitch it to Christ Incubation Consultation Foundation. 
                    Getting accepted there was the validation we needed to turn our idea into reality."
                  </p>
                  <p className="text-[#154CB3] font-medium text-sm mt-2">
                    — The Journey Begins
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">Timeline</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#063168] mb-2">
              Our Journey
            </h2>
            <div className="mt-3 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 transform md:-translate-x-px h-full w-0.5 bg-[#154CB3]"></div>
            
            {milestones.map((milestone, index) => (
              <div key={index} className="relative flex items-center mb-8">
                <div className="flex items-center w-full">
                  {/* Timeline dot */}
                  <div className="absolute left-4 md:left-1/2 transform -translate-x-1/2 w-4 h-4 bg-[#154CB3] rounded-full border-4 border-white shadow-lg z-10"></div>
                  
                  {/* Content */}
                  <div className={`ml-12 md:ml-0 md:w-5/12 ${index % 2 === 0 ? 'md:mr-auto md:text-right md:pr-8' : 'md:ml-auto md:pl-8'}`}>
                    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200">
                      <div className="flex items-start">
                        {renderIcon(milestone.icon)}
                        <div className="flex-1">
                          <div className="text-sm font-bold text-[#154CB3] mb-1">
                            {milestone.year} {milestone.quarter}
                          </div>
                          <h3 className="text-lg font-bold text-gray-800 mb-2">
                            {milestone.title}
                          </h3>
                          <p className="text-gray-600 text-sm">
                            {milestone.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Impact Section */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">Numbers</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#063168] mb-2">
              Our Impact Today
            </h2>
            <div className="mt-3 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="bg-gradient-to-br from-[#154CB3] to-[#063168] text-white p-6 rounded-xl">
              <div className="text-3xl font-black mb-2">4+</div>
              <div className="text-sm text-blue-100">Campuses Connected</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl">
              <div className="text-3xl font-black mb-2">20K+</div>
              <div className="text-sm text-green-100">Active Students</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-xl">
              <div className="text-3xl font-black mb-2">500+</div>
              <div className="text-sm text-yellow-100">Events Hosted</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl">
              <div className="text-3xl font-black mb-2">95%</div>
              <div className="text-sm text-purple-100">User Satisfaction</div>
            </div>
          </div>
        </div>

        {/* Values Section */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">Purpose</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#063168] mb-2">
              What Drives Us
            </h2>
            <div className="mt-3 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-[#154CB3] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zM4.78 15.435A21.95 21.95 0 0110 15c1.845 0 3.64-.226 5.36-.652a.75.75 0 01.518 1.408A20.69 20.69 0 0110 16.5c-1.195 0-2.37-.084-3.5-.248a1.5 1.5 0 01-.72-2.817z" clipRule="evenodd"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">
                Student-First
              </h3>
              <p className="text-gray-600 text-sm">
                Every feature we build starts with the question: "How will this help students connect better with their campus?"
              </p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-[#FFCC00] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#063168]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">
                Continuous Innovation
              </h3>
              <p className="text-gray-600 text-sm">
                We're constantly improving based on feedback, adding new features that make campus life more vibrant.
              </p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">
                Community Building
              </h3>
              <p className="text-gray-600 text-sm">
                Our mission is to eliminate FOMO and help every student find their place in the campus community.
              </p>
            </div>
          </div>
        </div>

        {/* Future Vision */}
        <div className="bg-gradient-to-br from-[#063168] to-[#154CB3] text-white p-8 sm:p-14 rounded-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-6">
            What&apos;s Next?
          </h2>
          <p className="text-base sm:text-lg text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
            We&apos;re just getting started. Our vision is to transform campus life at universities across the country,
            making every student feel connected and engaged with their academic community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/Discover"
              className="bg-[#FFCC00] text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-yellow-400 transition-all"
            >
              Join Our Community
            </Link>
            <Link
              href="/contact"
              className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-all"
            >
              Get In Touch
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default StoryPage;
