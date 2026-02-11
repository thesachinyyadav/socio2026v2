"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import Footer from "../../_components/Home/Footer";

export default function TeamPage() {
  // Icon renderer function
  const renderValueIcon = (iconName: string) => {
    const iconClass = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4";
    
    switch (iconName) {
      case "innovation":
        return (
          <div className={`${iconClass} bg-[#FFCC00]`}>
            <svg className="w-8 h-8 text-[#063168]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        );
      case "collaboration":
        return (
          <div className={`${iconClass} bg-[#154CB3]`}>
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
            </svg>
          </div>
        );
      case "transparency":
        return (
          <div className={`${iconClass} bg-green-500`}>
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
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

  const founders = [
    {
      name: "Sachin Yadav",
      role: "Co-Founder & Lead Developer",
      bio: "Digital Mission trainer turned entrepreneur. Started as a Python trainer for BBA classes where the SOCIO idea was born. Now leads technical architecture and development.",
      skills: ["React/Next.js", "Node.js", "Database Design", "Digital Training"],
      email: "sachinyadavparasf@gmail.com",
      linkedin: "https://www.linkedin.com/in/thesachinyyadav/",
      github: "https://github.com/thesachinyyadav",
      quote: "From teaching Python in classrooms to building platforms that connect campuses.",
      funFact: "Transitioned from being a Digital Mission trainer to a full-stack developer entrepreneur.",
      image: "/founder-sachin-yadav.jpg"
    },
    {
      name: "Surya Vamshi",
      role: "Co-Founder & Product Manager", 
      bio: "Former Digital Mission trainer with expertise in product strategy. Co-founded SOCIO after meeting Meeth during BBA Python training sessions.",
      skills: ["Product Strategy", "Digital Training", "Project Management", "User Research"],
      email: "surya.s@bcah.christuniversity.in",
      linkedin: "https://www.linkedin.com/in/suryaavamshi/",
      github: "https://github.com/thesachinyyadav",
      quote: "Great ideas often come from the most unexpected classroom conversations.",
      funFact: "Went from training students in programming to building products that serve thousands of students.",
      image: "/founder-surya-vamshi.jpg"
    },
    {
      name: "Meeth Shah",
      role: "Co-Founder & Design Lead",
      bio: "The visionary who brought the initial idea to life. Met Sachin and Surya during Python training sessions and together they incubated SOCIO through Christ Incubation Foundation.",
      skills: ["UI/UX Design", "Brand Identity", "Innovation", "Strategic Planning"],
      email: "thesocio.blr@gmail.com",
      linkedin: "https://www.linkedin.com/in/meeth-shah-75b182214/",
      dribbble: "https://dribbble.com/meethshah",
      quote: "Sometimes the best ideas come from connecting with the right people at the right time.",
      funFact: "Met the co-founders during a Python training session and turned a casual conversation into a startup.",
      image: "/founder-meeth-shah.jpg"
    }
  ];

  const advisors = [
    {
      name: "Dr. Smitha Vinod",
      role: "Faculty Advisor",
      department: "Department of Computer Science",
      bio: "Associate Professor providing academic guidance and ensuring SOCIO aligns with educational best practices.",
      expertise: ["Software Engineering", "Academic Innovation", "Student Development"],
      photo: "/faculty-smitha-vinod.jpg"
    },
    {
      name: "Dr. Shruti Srinivasan",
      role: "Head of Christ Incubation and Consultancy Foundation (CICF)",
      department: "Department of Business Management",
      bio: "Leading Christ University's incubation initiatives and providing strategic guidance for startup development and business consultancy.",
      expertise: ["Business Strategy", "Startup Incubation", "Entrepreneurship", "Consultancy Management"],
      photo: "/faculty-shruti-srinivasan.jpg"
    }
  ];

  const values = [
    {
      title: "Student-Centric",
      description: "Every decision we make starts with asking: 'How does this help students?'",
      icon: "🎓"
    },
    {
      title: "Innovation",
      description: "We're constantly pushing boundaries to create better solutions for campus life.",
      icon: "innovation"
    },
    {
      title: "Collaboration", 
      description: "Great things happen when people work together toward a common goal.",
      icon: "collaboration"
    },
    {
      title: "Transparency",
      description: "We believe in open communication and honest feedback from our community.",
      icon: "transparency"
    }
  ];

  const milestones = [
    {
      achievement: "Launched across 4+ campuses",
      metric: "4+",
      description: "Successfully expanded beyond our home campus"
    },
    {
      achievement: "Served 20,000+ students",
      metric: "20K+",
      description: "Growing community of active users"
    },
    {
      achievement: "Managed 500+ events",
      metric: "500+",
      description: "Helping organizers reach their audience"
    },
    {
      achievement: "Maintained 95% satisfaction",
      metric: "95%",
      description: "High user satisfaction ratings"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Meet Our Team
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
        </div>

        {/* Hero Section */}
        <div className="relative mb-20 overflow-hidden rounded-2xl bg-gradient-to-br from-[#063168] via-[#154CB3] to-[#1e6fd9] text-white p-8 sm:p-16">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-[#FFCC00]/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
          
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/20">
              <span className="w-2 h-2 bg-[#FFCC00] rounded-full animate-pulse" />
              <span className="text-sm font-medium text-blue-100">Building the future of campus life</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-6 leading-tight">
              From Trainers to<br />
              <span className="text-[#FFCC00]">Entrepreneurs</span>
            </h2>
            <p className="text-lg sm:text-xl text-blue-100 mb-4 max-w-3xl mx-auto leading-relaxed">
              We&apos;re Digital Mission trainers who became entrepreneurs. Our journey started in a BBA classroom 
              teaching Python, where we identified a real problem and decided to solve it together.
            </p>
            <p className="text-base sm:text-lg text-blue-200/80 max-w-2xl mx-auto">
              Our team has grown from 3 founders to include 11 talented interns across technical and business domains, 
              all working together to transform campus life.
            </p>
          </div>
        </div>

        {/* Founders Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">The Founders</span>
            <h2 className="text-2xl sm:text-4xl font-black text-[#063168]">
              Founding Team
            </h2>
            <div className="mt-4 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {founders.map((founder, index) => (
              <div key={index} className="group relative bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:-translate-y-1">
                {/* Profile Image Area */}
                <div className="relative h-56 bg-gradient-to-br from-[#154CB3] to-[#063168] flex items-center justify-center overflow-hidden">
                  {/* Decorative ring */}
                  <div className="absolute w-44 h-44 border-2 border-white/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute w-52 h-52 border border-white/5 rounded-full group-hover:scale-105 transition-transform duration-700" />
                  {founder.image ? (
                    <Image 
                      src={founder.image} 
                      alt={founder.name}
                      width={128}
                      height={128}
                      className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg group-hover:scale-105 transition-transform duration-500 relative z-10"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg relative z-10">
                      <span className="text-[#154CB3] text-3xl font-bold">
                        {founder.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  )}
                  {/* Gradient overlay at bottom for smooth blend */}
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                </div>
                
                <div className="p-6 pt-4">
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-black text-gray-900 mb-1">
                      {founder.name}
                    </h3>
                    <p className="text-[#154CB3] font-semibold text-sm">
                      {founder.role}
                    </p>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-5 leading-relaxed text-center">
                    {founder.bio}
                  </p>
                  
                  {/* Quote */}
                  <div className="relative bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl mb-5">
                    <svg className="absolute top-2 left-3 w-5 h-5 text-[#154CB3]/20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11H10v10H0z"/>
                    </svg>
                    <p className="text-gray-700 italic text-sm pl-6 leading-relaxed">
                      {founder.quote}
                    </p>
                  </div>
                  
                  {/* Skills */}
                  <div className="mb-5">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expertise</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {founder.skills.map((skill, skillIndex) => (
                        <span key={skillIndex} className="bg-[#154CB3]/8 text-[#154CB3] px-3 py-1 rounded-full text-xs font-semibold border border-[#154CB3]/15">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Fun Fact */}
                  <div className="mb-5 flex items-start gap-2">
                    <span className="text-base mt-0.5">💡</span>
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Fun Fact</h4>
                      <p className="text-gray-600 text-xs leading-relaxed">
                        {founder.funFact}
                      </p>
                    </div>
                  </div>
                  
                  {/* Contact Links */}
                  <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-100">
                    <a
                      href={`mailto:${founder.email}`}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-all duration-300"
                      title="Email"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </a>
                    <a
                      href={founder.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-all duration-300"
                      title="LinkedIn"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd" />
                      </svg>
                    </a>
                    {founder.github && (
                      <a
                        href={founder.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-all duration-300"
                        title="GitHub"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                        </svg>
                      </a>
                    )}
                    {founder.dribbble && (
                      <a
                        href={founder.dribbble}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-all duration-300"
                        title="Dribbble"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 5.523 4.477 10 10 10 5.523 0 10-4.477 10-10C20 4.477 15.523 0 10 0zm6.231 4.75a8.32 8.32 0 011.562 4.939c-.263-.056-2.902-.574-5.569-.263-.059-.135-.133-.28-.213-.433 1.738-.71 3.118-1.644 4.22-4.243zm-1.44-1.46c-.956 2.345-2.176 3.118-3.684 3.687C9.97 4.222 8.446 2.614 6.197 1.904 7.413.72 9.17 0 11.07.02c1.955.02 3.706.687 4.72 3.27zm-7.19-1.233c2.326.665 3.849 2.154 4.925 4.74-1.686.447-3.482.632-5.949.632-.542 0-.832-.01-1.13-.02-.169-1.336-.169-2.672.154-5.352zm-.4 6.253c.309.01.618.01.96.01 2.406 0 4.15-.174 5.734-.608C12.18 11.388 10.51 14.52 8.11 16.655c-1.854-1.378-3.118-3.506-3.508-5.945zm5.734 7.121c1.995-2.135 3.486-4.907 4.654-8.413 2.096.281 3.994.665 5.425 1.183-.464 3.546-2.359 6.584-5.07 8.553-1.595-.458-3.214-.892-5.009-1.323z" clipRule="evenodd" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advisors Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">Growing Together</span>
            <h2 className="text-2xl sm:text-4xl font-black text-[#063168]">
              Our Growing Team
            </h2>
            <div className="mt-4 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          
          {/* Team Expansion Story */}
          <div className="mb-14 relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 p-8 sm:p-10 rounded-2xl border border-blue-100">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#154CB3]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#154CB3] rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#063168]">Team Expansion</h3>
                  <p className="text-xs text-[#154CB3] font-semibold">March 2025</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                After our successful incubation, we expanded our team to bring diverse expertise and fresh perspectives to SOCIO.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-white shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-[#154CB3]/10 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800">Technical Team</h4>
                  </div>
                  <p className="text-sm text-[#154CB3] font-semibold mb-3">
                    4 Technical Interns
                  </p>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#154CB3] rounded-full" /> Frontend Development & UI/UX</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#154CB3] rounded-full" /> Backend Development & Database</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#154CB3] rounded-full" /> Mobile App Development</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#154CB3] rounded-full" /> Quality Assurance & Testing</li>
                  </ul>
                </div>
                <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-white shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-[#FFCC00]/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#063168]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-800">Business Team</h4>
                  </div>
                  <p className="text-sm text-[#154CB3] font-semibold mb-3">
                    7 Finance & Research Interns
                  </p>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#FFCC00] rounded-full" /> Market Research & User Analysis</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#FFCC00] rounded-full" /> Financial Planning & Strategy</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#FFCC00] rounded-full" /> Marketing & Community Outreach</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#FFCC00] rounded-full" /> Partnership Development</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mb-10">
            <span className="inline-block text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">Guidance</span>
            <h3 className="text-2xl sm:text-3xl font-black text-[#063168]">
              Faculty Advisors
            </h3>
            <div className="mt-4 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {advisors.map((advisor, index) => (
              <div key={index} className="group bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-500 border border-gray-100 hover:-translate-y-1">
                <div className="flex items-start gap-6 mb-6">
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-[#154CB3]/20 rounded-full scale-110 group-hover:scale-125 transition-transform duration-500" />
                    {advisor.photo ? (
                      <Image 
                        src={advisor.photo} 
                        alt={advisor.name}
                        width={80}
                        height={80}
                        className="relative w-20 h-20 rounded-full object-cover border-3 border-white shadow-lg"
                      />
                    ) : (
                      <div className="relative w-20 h-20 bg-gradient-to-br from-[#154CB3] to-[#063168] rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white text-2xl font-bold">
                          {advisor.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 mb-1">
                      {advisor.name}
                    </h3>
                    <p className="text-[#154CB3] font-bold text-sm mb-1">
                      {advisor.role}
                    </p>
                    <p className="text-gray-500 text-xs font-medium">
                      {advisor.department}
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                  {advisor.bio}
                </p>
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Areas of Expertise</h4>
                  <div className="flex flex-wrap gap-2">
                    {advisor.expertise.map((area, areaIndex) => (
                      <span key={areaIndex} className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-100">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Values Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <span className="inline-block text-sm font-bold text-[#154CB3] uppercase tracking-widest mb-2">What Drives Us</span>
            <h2 className="text-2xl sm:text-4xl font-black text-[#063168]">
              Our Values
            </h2>
            <div className="mt-4 w-16 h-1 bg-[#FFCC00] mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div key={index} className="group text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#154CB3]/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  {renderValueIcon(value.icon)}
                  <h3 className="text-lg font-black text-gray-900 mb-3">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Achievements */}
        <div className="mb-20 relative overflow-hidden bg-gradient-to-br from-[#063168] via-[#154CB3] to-[#1e6fd9] text-white p-8 sm:p-14 rounded-2xl">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 -translate-x-1/3" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#FFCC00]/10 rounded-full translate-y-1/3 translate-x-1/4" />
          <div className="relative">
            <div className="text-center mb-10">
              <span className="inline-block text-sm font-bold text-[#FFCC00] uppercase tracking-widest mb-2">Impact</span>
              <h2 className="text-2xl sm:text-4xl font-black">
                What We&apos;ve Achieved Together
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {milestones.map((milestone, index) => (
                <div key={index} className="group">
                  <div className="text-4xl sm:text-5xl font-black mb-2 text-[#FFCC00] group-hover:scale-110 transition-transform duration-300">
                    {milestone.metric}
                  </div>
                  <div className="text-sm sm:text-base font-semibold mb-1">
                    {milestone.achievement}
                  </div>
                  <div className="text-xs text-blue-200/70">
                    {milestone.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Join Us Section */}
        <div className="text-center mb-16 py-8">
          <div className="inline-flex items-center gap-2 bg-[#154CB3]/5 px-4 py-2 rounded-full mb-6 border border-[#154CB3]/10">
            <span className="w-2 h-2 bg-[#FFCC00] rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-[#154CB3]">We&apos;re hiring</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-[#063168] mb-6">
            Want to Join Our Mission?
          </h2>
          <p className="text-gray-500 mb-10 max-w-2xl mx-auto text-base leading-relaxed">
            We&apos;re always looking for passionate students who want to help improve campus life. 
            Whether you&apos;re a developer, designer, or just someone with great ideas, we&apos;d love to hear from you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-[#154CB3] text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-[#063168] transition-all duration-300 shadow-lg shadow-[#154CB3]/25 hover:shadow-xl hover:shadow-[#154CB3]/30"
            >
              Get In Touch
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a
              href="mailto:thesocio.blr@gmail.com"
              className="inline-flex items-center justify-center gap-2 border-2 border-[#154CB3] text-[#154CB3] px-8 py-3.5 rounded-xl font-semibold hover:bg-[#154CB3] hover:text-white transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Our Team
            </a>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
