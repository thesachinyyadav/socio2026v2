"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import Link from 'next/link';

const ComingSoon = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pwaUrl = process.env.NEXT_PUBLIC_PWA_URL!;
  const pwaDisplayHost = (() => {
    try {
      return new URL(pwaUrl).host;
    } catch {
      return window.location.host;
    }
  })();

  useEffect(() => {
    if (!pageRef.current) return;

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
    <div ref={pageRef} className="relative isolate min-h-screen bg-gradient-to-b from-[#f8f9fc] to-[#e8f0ff] flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
      {/* Background Elements */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
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
          SOCIO Mobile App Launching Soon
        </h1>
        
        <div className="w-20 h-1 bg-[#FFCC00] mx-auto mb-8"></div>
        
        <h2 className="text-xl md:text-2xl text-[#063168] mb-4 font-medium inline-flex items-center justify-center gap-2">
          Our full mobile experience is coming soon
          <svg
            className="w-6 h-6 inline-block"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
            />
          </svg>
        </h2>
        
        <p className="text-[#1e1e1eb6] text-base md:text-lg mb-8 max-w-2xl mx-auto">
          SOCIO mobile is in final preparation and will be available shortly. While we complete the launch, you can use the Pre Beta Version App experience today.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Link href="/" className="btn bg-[#063168] hover:bg-[#154CB3] text-white font-medium py-3 px-6 rounded-md transition-all duration-300 shadow-md hover:shadow-lg">
            Back to Homepage
          </Link>
          <button 
            onClick={() => router.push('/Discover')}
            className="btn cursor-pointer bg-white border-2 border-[#3D75BD] text-[#063168] hover:bg-[#3D75BD]/10 font-medium py-3 px-6 rounded-md transition-all duration-300 shadow-md hover:shadow-lg"
          >
            Explore Events on Web
          </button>
          <a
            href={pwaUrl}
            target="_blank"
            rel="noreferrer"
            className="btn inline-flex items-center gap-3 bg-[#FFCC00] hover:bg-[#f7b500] text-[#063168] font-semibold py-3 px-6 rounded-md transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <span>{pwaDisplayHost}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </a>
        </div>

        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-12">
          <div className="flex items-center justify-center gap-2 bg-white px-6 py-4 rounded-lg shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#063168" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"></path>
              <path d="M12 6V12L16 14"></path>
            </svg>
            <span className="text-[#063168] font-medium">Estimated launch: June 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
