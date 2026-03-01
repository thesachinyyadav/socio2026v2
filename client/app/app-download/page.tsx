"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import Link from 'next/link';

const ComingSoon = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!pageRef.current) return;

    const elements = pageRef.current.querySelectorAll('h1, h2, p, .btn');
    
    gsap.from(elements, {
      opacity: 0,
      y: 30,
      stagger: 0.2,
      duration: 0.8,
      ease: "power3.out",
    });

    // Animation for the badge
    gsap.from('.badge', {
      scale: 0.8,
      opacity: 0,
      duration: 1,
      delay: 0.5,
      ease: "elastic.out(1, 0.5)",
    });

    // Animation for the pulse elements
    gsap.from('.pulse-circle', {
      scale: 0.5,
      opacity: 0,
      duration: 1.5,
      stagger: 0.2,
      ease: "power3.out",
    });

  }, []);

  return (
    <div ref={pageRef} className="min-h-screen bg-gradient-to-b from-[#f8f9fc] to-[#e8f0ff] flex flex-col items-center justify-center px-4 py-16">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="pulse-circle absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-blue-100 opacity-20 animate-pulse"></div>
        <div className="pulse-circle absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-yellow-100 opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Beta Badge */}
        <div className="badge inline-block mb-6 px-4 py-1.5 bg-[#FFCC00] text-[#063168] font-bold rounded-full text-sm">
          BETA
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6" style={{ 
          backgroundImage: 'linear-gradient(45deg, #063168, #3D75BD)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 5s ease infinite'
        }}>
          SOCIO Mobile App Coming Soon
        </h1>
        
        <div className="w-20 h-1 bg-[#FFCC00] mx-auto mb-8"></div>
        
        <h2 className="text-xl md:text-2xl text-[#063168] mb-4 font-medium">
          We're putting the finishing touches on something amazing
        </h2>
        
        <p className="text-[#1e1e1eb6] text-base md:text-lg mb-8 max-w-2xl mx-auto">
          The SOCIO mobile app is currently in beta testing. Our team is working hard to deliver a seamless experience for discovering, registering, and managing Christ University events across all campuses directly from your smartphone.
        </p>
        
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-12">
          <div className="flex items-center justify-center gap-2 bg-white px-6 py-4 rounded-lg shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#063168" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"></path>
              <path d="M12 6V12L16 14"></path>
            </svg>
            <span className="text-[#063168] font-medium">Estimated launch: March 2026</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/" className="btn bg-[#063168] hover:bg-[#154CB3] text-white font-medium py-3 px-6 rounded-md transition-all duration-300 shadow-md hover:shadow-lg">
            Back to Homepage
          </Link>
          <button 
            onClick={() => router.push('/Discover')}
            className="btn bg-white border-2 border-[#3D75BD] text-[#063168] hover:bg-[#3D75BD]/10 font-medium py-3 px-6 rounded-md transition-all duration-300 shadow-md hover:shadow-lg"
          >
            Explore Events on Web
          </button>
        </div>
      </div>
      
      {/* Newsletter signup (optional) */}
      <div className="mt-16 bg-white p-8 rounded-lg shadow-md max-w-xl w-full relative z-10">
        <h3 className="text-xl font-bold text-[#063168] mb-4">Get Early Access</h3>
        <p className="text-[#1e1e1eb6] mb-6">Sign up to be notified when the app launches and get early access to beta features.</p>
        <form className="flex flex-col sm:flex-row gap-3">
          <input 
            type="email" 
            placeholder="Your email address" 
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3D75BD]"
          />
          <button 
            type="button"
            className="bg-[#FFCC00] hover:bg-[#FFCC00]/90 text-[#063168] font-medium py-2.5 px-6 rounded-md transition-all duration-300"
          >
            Notify Me
          </button>
        </form>
      </div>
    </div>
  );
};

export default ComingSoon;
