"use client";

import React from "react";
import Link from "next/link";
import Footer from "../../_components/Home/Footer";

export default function MissionPage() {
  // Icon renderer function
  const renderIcon = (iconName: string) => {
    const iconClass = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4";
    
    switch (iconName) {
      case "target":
        return (
          <div className={`${iconClass} bg-[#154CB3]`}>
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zM4.78 15.435A21.95 21.95 0 0110 15c1.845 0 3.64-.226 5.36-.652a.75.75 0 01.518 1.408A20.69 20.69 0 0110 16.5c-1.195 0-2.37-.084-3.5-.248a1.5 1.5 0 01-.72-2.817z" clipRule="evenodd"/>
            </svg>
          </div>
        );
      case "innovation":
        return (
          <div className={`${iconClass} bg-[#FFCC00]`}>
            <svg className="w-8 h-8 text-[#063168]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </div>
        );
      case "community":
        return (
          <div className={`${iconClass} bg-green-500`}>
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className={`${iconClass} bg-gray-400`}>
            <span className="text-white text-xl font-bold">{iconName.charAt(0).toUpperCase()}</span>
          </div>
        );
    }
  };

  const missionPoints = [
    {
      title: "Eliminate FOMO",
      description: "No student should miss out on opportunities because they didn't know about them. We ensure every event reaches the right audience.",
      icon: "target",
      impact: "95% of students now discover events they're interested in"
    },
    {
      title: "Simplify Participation", 
      description: "From discovery to registration to attendance - we make the entire journey seamless and intuitive.",
      icon: "⚡",
      impact: "Registration time reduced from 10 minutes to under 1 minute"
    },
    {
      title: "Empower Organizers",
      description: "Give event organizers the tools they need to create, promote, and manage successful events effortlessly.",
      icon: "innovation",
      impact: "Event attendance increased by 40% on average"
    },
    {
      title: "Build Community",
      description: "Foster connections between students, clubs, and departments to create a more vibrant campus ecosystem.",
      icon: "community",
      impact: "20,000+ students connected across 4+ campuses"
    }
  ];

  const visionElements = [
    {
      title: "Universal Access",
      description: "Every student, regardless of their background or connections, should have equal access to campus opportunities.",
      color: "bg-blue-50 border-[#154CB3] text-blue-800"
    },
    {
      title: "Inclusive Growth",
      description: "We believe diverse perspectives make events better, and events make students more well-rounded.",
      color: "bg-green-50 border-green-500 text-green-800"
    },
    {
      title: "Continuous Innovation",
      description: "Technology should evolve to serve students better, not complicate their lives.",
      color: "bg-purple-50 border-purple-500 text-purple-800"
    },
    {
      title: "Sustainable Impact", 
      description: "Our solutions should benefit current students while creating a foundation for future generations.",
      color: "bg-yellow-50 border-yellow-500 text-yellow-800"
    }
  ];

  const principles = [
    {
      principle: "Student-First Design",
      description: "Every feature starts with student needs, not technology capabilities.",
      example: "Our QR attendance system exists because students wanted faster check-ins, not because QR codes were trendy."
    },
    {
      principle: "Inclusive by Default",
      description: "We design for accessibility and ensure no one is left behind.",
      example: "Events show clear accessibility information, and our platform works on any device or internet speed."
    },
    {
      principle: "Privacy & Safety",
      description: "Student data is sacred, and campus events should feel safe for everyone.",
      example: "We only collect necessary information and give students control over what they share."
    },
    {
      principle: "Community Driven",
      description: "The platform grows based on real feedback from real users.",
      example: "Our notification system was redesigned three times based on student suggestions."
    }
  ];

  const goals = [
    {
      timeframe: "Short Term (2025)",
      objectives: [
        "Expand to 10+ university campuses",
        "Integrate with existing university systems",
        "Launch mobile app with offline capabilities",
        "Introduce AI-powered event recommendations"
      ]
    },
    {
      timeframe: "Medium Term (2026-2027)",
      objectives: [
        "Serve 100,000+ students nationwide",
        "Partner with 50+ universities",
        "Launch inter-campus event sharing",
        "Develop event analytics for institutions"
      ]
    },
    {
      timeframe: "Long Term (2028+)",
      objectives: [
        "Become the standard for campus event management",
        "Expand to international universities",
        "Create alumni networking features",
        "Build the ultimate campus ecosystem platform"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Our Mission & Vision
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
            Discover what drives us and where we're heading in our mission to transform campus life.
          </p>
        </div>

        {/* Mission Statement */}
        <div className="mb-16 bg-gradient-to-r from-[#154CB3] to-[#063168] text-white p-6 sm:p-12 rounded-lg text-center">
          <h2 className="text-2xl sm:text-4xl font-black mb-8">
            Our Mission
          </h2>
          <div className="max-w-4xl mx-auto">
            <p className="text-xl sm:text-2xl text-blue-100 mb-6 leading-relaxed">
              To eliminate FOMO and create meaningful connections by making campus events 
              accessible, discoverable, and engaging for every student.
            </p>
            <p className="text-lg text-blue-200">
              We believe every student deserves to experience the full richness of campus life, 
              and technology should make that easier, not harder.
            </p>
          </div>
        </div>

        {/* Mission Breakdown */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#063168] mb-8 text-center">
            How We're Achieving Our Mission
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {missionPoints.map((point, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4 mt-1">{point.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {point.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {point.description}
                    </p>
                    <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                      <p className="text-green-800 text-sm font-medium">
                        Impact: {point.impact}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vision Statement */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#063168] mb-6">
              Our Vision
            </h2>
            <div className="max-w-4xl mx-auto bg-[#FFCC00]/10 border-l-4 border-[#FFCC00] p-6 sm:p-8 rounded-lg">
              <p className="text-xl sm:text-2xl text-gray-800 font-medium mb-4">
                A world where every student feels connected, informed, and empowered 
                to make the most of their campus experience.
              </p>
              <p className="text-gray-600">
                We envision campuses where opportunities are abundant, accessible, and inclusive – 
                where technology serves as a bridge, not a barrier, to meaningful experiences.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visionElements.map((element, index) => (
              <div key={index} className={`${element.color} border-l-4 p-6 rounded-lg`}>
                <h3 className="text-lg font-bold mb-3">
                  {element.title}
                </h3>
                <p className="text-sm">
                  {element.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Guiding Principles */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#063168] mb-8 text-center">
            Our Guiding Principles
          </h2>
          <div className="space-y-6">
            {principles.map((item, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between">
                  <div className="flex-1 mb-4 lg:mb-0 lg:mr-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      {item.principle}
                    </h3>
                    <p className="text-gray-600 mb-3">
                      {item.description}
                    </p>
                  </div>
                  <div className="lg:w-2/5 bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-[#154CB3] mb-2">
                      Example in Action:
                    </h4>
                    <p className="text-gray-700 text-sm">
                      {item.example}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goals & Roadmap */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#063168] mb-8 text-center">
            Our Roadmap
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {goals.map((goal, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-[#154CB3] mb-2">
                    {goal.timeframe}
                  </h3>
                  <div className="w-12 h-1 bg-[#154CB3] mx-auto rounded-full"></div>
                </div>
                <ul className="space-y-3">
                  {goal.objectives.map((objective, objIndex) => (
                    <li key={objIndex} className="flex items-start">
                      <div className="w-2 h-2 bg-[#FFCC00] rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span className="text-gray-700 text-sm">{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Impact Metrics */}
        <div className="mb-16 bg-gradient-to-br from-gray-50 to-blue-50 p-6 sm:p-12 rounded-lg">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#063168] mb-8 text-center">
            Our Impact So Far
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl font-black text-[#154CB3] mb-2">4+</div>
              <div className="text-sm text-gray-600">Campuses Served</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl font-black text-green-600 mb-2">20K+</div>
              <div className="text-sm text-gray-600">Active Students</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl font-black text-yellow-600 mb-2">500+</div>
              <div className="text-sm text-gray-600">Events Managed</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl font-black text-purple-600 mb-2">95%</div>
              <div className="text-sm text-gray-600">Satisfaction Rate</div>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <h3 className="text-xl font-bold text-[#063168] mb-4">
              What This Means
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="bg-white p-6 rounded-lg shadow-sm text-left">
                <h4 className="font-bold text-gray-800 mb-2">For Students:</h4>
                <p className="text-gray-600 text-sm">
                  Fewer missed opportunities, easier event discovery, and more meaningful campus connections.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm text-left">
                <h4 className="font-bold text-gray-800 mb-2">For Organizers:</h4>
                <p className="text-gray-600 text-sm">
                  Higher attendance rates, streamlined management, and better engagement with their target audience.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-[#154CB3] to-[#063168] text-white p-6 sm:p-12 rounded-lg text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            Join Our Mission
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-3xl mx-auto">
            Whether you're a student looking to get more involved, an organizer wanting better tools, 
            or someone who believes in our vision, there are many ways to be part of this journey.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/Discover"
              className="bg-[#FFCC00] text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-yellow-400 transition-all"
            >
              Start Exploring Events
            </Link>
            <Link
              href="/contact"
              className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-white/10 transition-all"
            >
              Share Your Ideas
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
