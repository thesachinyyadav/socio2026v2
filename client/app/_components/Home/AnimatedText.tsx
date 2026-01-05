"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import './AnimatedText.css';
import './animation-fix.css';

interface AnimatedTextProps {
  className?: string;
}

const AnimatedText: React.FC<AnimatedTextProps> = ({ className = "" }) => {
  const textRef = useRef<HTMLDivElement>(null);
  const charElements = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    console.log("AnimatedText component mounted");
    
    // Register GSAP plugins
    gsap.registerPlugin(ScrollTrigger);
    
    if (!textRef.current) return;
    
    // Get all character elements
    const chars = Array.from(textRef.current.querySelectorAll('.char'));
    charElements.current = chars as HTMLSpanElement[];
    
    // Initialize positions
    gsap.set(charElements.current, { 
      y: 0,
      opacity: 0,
      rotateX: -90,
      transformOrigin: "50% 50% -20px"
    });

    // Create a timeline for the initial animation
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: textRef.current,
        start: "top 80%",
        end: "bottom 20%",
        toggleActions: "play none none reverse",
      }
    });

    // Animate each character with a stagger
    tl.to(charElements.current, {
      duration: 0.8,
      opacity: 1,
      y: 0,
      rotateX: 0,
      stagger: 0.03,
      ease: "back.out(1.7)",
    });

    // Cleanup function
    return () => {
      if (tl.scrollTrigger) {
        tl.scrollTrigger.kill();
      }
    };
  }, []);

  // Function to split text into words and characters with spans
  const splitText = (text: string) => {
    // Split by bullet point with spaces to get the words
    const words = text.split(' • ');
    
    return words.map((word, wordIndex) => (
      <span key={wordIndex} className="word-group" data-word-index={wordIndex}>
        {word.split('').map((char, charIndex) => (
          <span 
            key={`${wordIndex}-${charIndex}`}
            className={`char`} 
            data-word={wordIndex}
            style={{ 
              display: 'inline-block', 
              position: 'relative',
              padding: '0 1px'
            }}
          >
            {char}
          </span>
        ))}
        {wordIndex < words.length - 1 && (
          <span className="space-dot">
            <span className="char space" data-separator="true" style={{ padding: '0 0.3em' }}> • </span>
          </span>
        )}
      </span>
    ));
  };

  return (
    <div 
      ref={textRef} 
      className={`animated-text-container py-8 sm:py-10 md:py-12 ${className} relative`}
      style={{
        perspective: '1000px',
        marginTop: '-1rem',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <img 
            src="/images/animated-dots.svg" 
            alt="" 
            className="w-full h-full object-cover opacity-40"
            style={{ filter: 'blur(1px)' }}
          />
        </div>
      </div>
      
      {/* Floating graphics */}
      <div className="absolute top-1/4 left-1/6 w-24 h-24 md:w-32 md:h-32">
        <img 
          src="/images/blob.svg" 
          alt="" 
          className="w-full h-full object-contain opacity-10 animate-float" 
          style={{ 
            animationDuration: '8s',
            transform: 'rotate(45deg) scale(1.2)'
          }}
        />
      </div>
      <div className="absolute bottom-1/4 right-1/6 w-24 h-24 md:w-32 md:h-32">
        <img 
          src="/images/blob.svg" 
          alt="" 
          className="w-full h-full object-contain opacity-10 animate-float" 
          style={{ 
            animationDuration: '6s',
            transform: 'rotate(-30deg) scale(0.8)',
            animationDelay: '1s'
          }}
        />
      </div>
      
      {/* Icon elements */}
      <div className="absolute top-1/2 left-[15%] transform -translate-y-1/2 hidden md:block">
        <div className="opacity-30 animate-bounce" style={{ animationDuration: '3s' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#154CB3" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
            <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
          </svg>
        </div>
      </div>
      <div className="absolute top-1/2 right-[15%] transform -translate-y-1/2 hidden md:block">
        <div className="opacity-30 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#FFCC00" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 19v-7M12 19v-7M16 19v-7M3 7h18M5 7l1-5h12l1 5"></path>
          </svg>
        </div>
      </div>
      
      <div className="container mx-auto text-center px-4 relative z-10">
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 inline-block animated-heading shine" 
          id="animated-text"
          style={{ 
            backgroundImage: 'linear-gradient(45deg, #063168, #3D75BD, #FFCC00, #3D75BD, #063168)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '300% 100%',
            animation: 'gradient-flow 8s ease infinite'
          }}
        >
          {splitText("CONNECT • DISCOVER • EXPERIENCE")}
        </h2>
      </div>
      
      <style jsx>{`
        @keyframes gradient-flow {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        
        @keyframes float {
          0% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-15px) rotate(5deg); }
          100% { transform: translateY(0) rotate(0); }
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animated-heading {
          position: relative;
          animation: gradient-flow 8s ease infinite;
        }
        
        .animated-heading::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 10%;
          right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255, 204, 0, 0.7), transparent);
          animation: blink 2s ease-in-out infinite;
        }
        
        .animate-word {
          animation: word-highlight 9s ease-in-out infinite;
        }
        
        .pulse-animation {
          animation: pulse-animation 2s ease-in-out infinite;
        }

        @keyframes word-highlight {
          0%, 30%, 100% {
            transform: translateY(0) scale(1);
            color: inherit;
            text-shadow: none;
          }
          5%, 25% {
            transform: translateY(-5px) scale(1.05);
            color: #FFCC00;
            text-shadow: 0 0 8px rgba(255, 204, 0, 0.6);
          }
        }
        
        @keyframes pulse-animation {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
};

export default AnimatedText;